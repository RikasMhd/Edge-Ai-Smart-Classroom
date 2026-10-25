import time
from datetime import datetime, timedelta

class ACSimulator:
    def __init__(self):
        self.occupancy_level = "LOW"
        self.person_count = 0
        self.ac_state = "OFF"
        self.temperature = None
        self.mode = "AUTO"  # "AUTO" (AI driven) or "MANUAL" (Override)
        
        # Timer tracking
        self.total_running_seconds = 0
        self.last_ac_on_timestamp = None
        self.last_updated = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        # History Timeline (Limit to last 50 events)
        self.history = []
        self._record_history_event("System initialized - AC OFF")

    def evaluate_occupancy(self, occupancy_level, person_count=None, source="AI"):
        """
        Evaluate occupancy and update AC state according to specifications:
        LOW    (0-2 people)  -> AC OFF, Temp: None
        MEDIUM (3-9 people)  -> AC ON,  Temp: 24°C
        HIGH   (10+ people)  -> AC ON,  Temp: 20°C
        """
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        self.occupancy_level = occupancy_level
        if person_count is not None:
            self.person_count = person_count
        elif occupancy_level == "LOW":
            self.person_count = 1
        elif occupancy_level == "MEDIUM":
            self.person_count = 5
        elif occupancy_level == "HIGH":
            self.person_count = 12

        previous_ac_state = self.ac_state

        if occupancy_level == "LOW":
            new_ac_state = "OFF"
            new_temp = None
        elif occupancy_level == "MEDIUM":
            new_ac_state = "ON"
            new_temp = 24
        elif occupancy_level == "HIGH":
            new_ac_state = "ON"
            new_temp = 20
        else:
            new_ac_state = "OFF"
            new_temp = None

        # Update running time tracking before state transition
        self.update_running_time()

        if new_ac_state == "ON" and previous_ac_state == "OFF":
            self.last_ac_on_timestamp = time.time()
        elif new_ac_state == "OFF" and previous_ac_state == "ON":
            self.last_ac_on_timestamp = None

        state_changed = (previous_ac_state != new_ac_state) or (self.temperature != new_temp)
        
        self.ac_state = new_ac_state
        self.temperature = new_temp
        self.last_updated = now_str

        if state_changed:
            self._record_history_event(f"Occupancy set to {occupancy_level} ({self.person_count} occupants) -> AC {new_ac_state} ({f'{new_temp}°C' if new_temp else 'N/A'})")

        return self.get_status()

    def update_running_time(self):
        """Accumulate active AC running time if AC is currently ON."""
        if self.ac_state == "ON" and self.last_ac_on_timestamp is not None:
            now = time.time()
            elapsed = now - self.last_ac_on_timestamp
            self.total_running_seconds += elapsed
            self.last_ac_on_timestamp = now

    def reset_running_time(self):
        self.total_running_seconds = 0
        if self.ac_state == "ON":
            self.last_ac_on_timestamp = time.time()
        self._record_history_event("AC Running Time reset to 00:00:00")

    def get_formatted_running_time(self):
        self.update_running_time()
        total_sec = int(self.total_running_seconds)
        hours = total_sec // 3600
        minutes = (total_sec % 3600) // 60
        seconds = total_sec % 60
        return f"{hours:02d}:{minutes:02d}:{seconds:02d}"

    def _record_history_event(self, description):
        event = {
            "timestamp": datetime.now().strftime("%H:%M:%S"),
            "datetime": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "occupancy": self.occupancy_level,
            "person_count": self.person_count,
            "ac_state": self.ac_state,
            "temperature": self.temperature,
            "description": description
        }
        self.history.append(event)
        if len(self.history) > 50:
            self.history.pop(0)

    def get_status(self):
        return {
            "occupancy": self.occupancy_level,
            "person_count": self.person_count,
            "ac_state": self.ac_state,
            "temperature": self.temperature,
            "running_time": self.get_formatted_running_time(),
            "running_seconds": int(self.total_running_seconds),
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "mode": self.mode
        }

    def get_history(self):
        return self.history
