import os
import tempfile
import numpy as np
import onnx
import onnxruntime
from PIL import Image, ImageDraw, ImageFont
import math

class CustomVisionObjectDetection:
    """
    Object Detection processor for Custom Vision ONNX model.
    Handles anchor calculations, NMS, and bounding box postprocessing.
    """
    ANCHORS = np.array([[0.573, 0.677], [1.87, 2.06], [3.34, 5.47], [7.88, 3.53], [9.77, 9.17]])
    IOU_THRESHOLD = 0.45
    DEFAULT_INPUT_SIZE = 512 * 512

    def __init__(self, labels, prob_threshold=0.25, max_detections=30):
        self.labels = labels
        self.prob_threshold = prob_threshold
        self.max_detections = max_detections

    def _logistic(self, x):
        return np.where(x > 0, 1 / (1 + np.exp(-x)), np.exp(x) / (1 + np.exp(x)))

    def _non_maximum_suppression(self, boxes, class_probs, max_detections):
        if len(boxes) == 0:
            return [], [], []
        max_detections = min(max_detections, len(boxes))
        max_probs = np.amax(class_probs, axis=1)
        max_classes = np.argmax(class_probs, axis=1)

        areas = boxes[:, 2] * boxes[:, 3]
        selected_boxes = []
        selected_classes = []
        selected_probs = []

        while len(selected_boxes) < max_detections and len(max_probs) > 0:
            i = np.argmax(max_probs)
            if max_probs[i] < self.prob_threshold:
                break

            selected_boxes.append(boxes[i])
            selected_classes.append(max_classes[i])
            selected_probs.append(max_probs[i])

            box = boxes[i]
            other_indices = np.concatenate((np.arange(i), np.arange(i + 1, len(boxes))))
            if len(other_indices) == 0:
                break
            other_boxes = boxes[other_indices]

            x1 = np.maximum(box[0], other_boxes[:, 0])
            y1 = np.maximum(box[1], other_boxes[:, 1])
            x2 = np.minimum(box[0] + box[2], other_boxes[:, 0] + other_boxes[:, 2])
            y2 = np.minimum(box[1] + box[3], other_boxes[:, 1] + other_boxes[:, 3])
            w = np.maximum(0, x2 - x1)
            h = np.maximum(0, y2 - y1)

            overlap_area = w * h
            union_area = areas[i] + areas[other_indices] - overlap_area
            iou = np.zeros_like(overlap_area, dtype=float)
            nonzero_mask = union_area > 0
            iou[nonzero_mask] = overlap_area[nonzero_mask] / union_area[nonzero_mask]

            overlapping_indices = other_indices[np.where(iou > self.IOU_THRESHOLD)[0]]
            overlapping_indices = np.append(overlapping_indices, i)

            class_probs[overlapping_indices, max_classes[i]] = 0
            max_probs[overlapping_indices] = np.amax(class_probs[overlapping_indices], axis=1)
            max_classes[overlapping_indices] = np.argmax(class_probs[overlapping_indices], axis=1)

        return selected_boxes, selected_classes, selected_probs

    def _extract_bb(self, prediction_output, anchors):
        num_anchor = anchors.shape[0]
        height, width, channels = prediction_output.shape
        num_class = int(channels / num_anchor) - 5

        outputs = prediction_output.reshape((height, width, num_anchor, -1))

        x = (self._logistic(outputs[..., 0]) + np.arange(width)[np.newaxis, :, np.newaxis]) / width
        y = (self._logistic(outputs[..., 1]) + np.arange(height)[:, np.newaxis, np.newaxis]) / height
        w = np.exp(outputs[..., 2]) * anchors[:, 0][np.newaxis, np.newaxis, :] / width
        h = np.exp(outputs[..., 3]) * anchors[:, 1][np.newaxis, np.newaxis, :] / height

        x = x - w / 2
        y = y - h / 2
        boxes = np.stack((x, y, w, h), axis=-1).reshape(-1, 4)

        objectness = self._logistic(outputs[..., 4])
        class_probs = outputs[..., 5:]
        class_probs = np.exp(class_probs - np.amax(class_probs, axis=3)[..., np.newaxis])
        class_probs = class_probs / np.sum(class_probs, axis=3)[..., np.newaxis] * objectness[..., np.newaxis]
        class_probs = class_probs.reshape(-1, num_class)

        return boxes, class_probs

    def preprocess(self, image):
        image = image.convert("RGB") if image.mode != "RGB" else image
        ratio = math.sqrt(self.DEFAULT_INPUT_SIZE / image.width / image.height)
        new_width = int(image.width * ratio)
        new_height = int(image.height * ratio)
        new_width = 32 * math.ceil(new_width / 32)
        new_height = 32 * math.ceil(new_height / 32)
        return image.resize((new_width, new_height))

    def postprocess(self, prediction_outputs):
        boxes, class_probs = self._extract_bb(prediction_outputs, self.ANCHORS)
        max_probs = np.amax(class_probs, axis=1)
        index, = np.where(max_probs > self.prob_threshold)
        index = index[(-max_probs[index]).argsort()]

        selected_boxes, selected_classes, selected_probs = self._non_maximum_suppression(
            boxes[index], class_probs[index], self.max_detections
        )

        results = []
        for i in range(len(selected_boxes)):
            results.append({
                'probability': round(float(selected_probs[i]), 4),
                'tagId': int(selected_classes[i]),
                'tagName': self.labels[selected_classes[i]] if selected_classes[i] < len(self.labels) else "Person",
                'boundingBox': {
                    'left': round(float(selected_boxes[i][0]), 4),
                    'top': round(float(selected_boxes[i][1]), 4),
                    'width': round(float(selected_boxes[i][2]), 4),
                    'height': round(float(selected_boxes[i][3]), 4)
                }
            })
        return results

class ONNXInferenceEngine:
    def __init__(self, model_path, labels_path):
        self.model_path = model_path
        self.labels_path = labels_path
        self.session = None
        self.detector = None
        self.is_loaded = False
        self._load_model()

    def _load_model(self):
        try:
            if not os.path.exists(self.model_path):
                print(f"[Warning] Model file not found at {self.model_path}")
                return

            labels = ["Person"]
            if os.path.exists(self.labels_path):
                with open(self.labels_path, 'r') as f:
                    labels = [l.strip() for l in f.readlines() if l.strip()]

            model = onnx.load(self.model_path)
            with tempfile.TemporaryDirectory() as dirpath:
                temp = os.path.join(dirpath, "temp_model.onnx")
                model.graph.input[0].type.tensor_type.shape.dim[-1].dim_param = 'dim1'
                model.graph.input[0].type.tensor_type.shape.dim[-2].dim_param = 'dim2'
                onnx.save(model, temp)
                self.session = onnxruntime.InferenceSession(temp, providers=['CPUExecutionProvider'])

            self.input_name = self.session.get_inputs()[0].name
            self.is_fp16 = self.session.get_inputs()[0].type == 'tensor(float16)'
            self.detector = CustomVisionObjectDetection(labels)
            self.is_loaded = True
            print(f"[ONNXInferenceEngine] Model loaded successfully from {self.model_path}")
        except Exception as e:
            print(f"[ONNXInferenceEngine Error] Failed to load model: {e}")
            self.is_loaded = False

    def predict_pil(self, pil_image):
        if not self.is_loaded:
            return {"person_count": 0, "occupancy_level": "LOW", "predictions": [], "status": "Model not loaded"}

        preprocessed = self.detector.preprocess(pil_image)
        inputs = np.array(preprocessed, dtype=np.float32)[np.newaxis, :, :, (2, 1, 0)] # RGB -> BGR
        inputs = np.ascontiguousarray(np.rollaxis(inputs, 3, 1))

        if self.is_fp16:
            inputs = inputs.astype(np.float16)

        outputs = self.session.run(None, {self.input_name: inputs})
        output_matrix = np.squeeze(outputs).transpose((1, 2, 0)).astype(np.float32)

        predictions = self.detector.postprocess(output_matrix)
        person_count = len(predictions)

        # Categorize Occupancy Level
        if person_count <= 2:
            level = "LOW"
        elif person_count <= 9:
            level = "MEDIUM"
        else:
            level = "HIGH"

        return {
            "person_count": person_count,
            "occupancy_level": level,
            "predictions": predictions,
            "status": "Success"
        }
