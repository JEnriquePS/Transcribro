class DomainError(Exception):
    """Base for all domain errors."""


class JobNotFoundError(DomainError):
    def __init__(self, job_id: str):
        super().__init__(f"Job not found: {job_id}")
        self.job_id = job_id


class InvalidJobStateError(DomainError):
    def __init__(self, job_id: str, current_state: str, expected_states: list[str]):
        super().__init__(
            f"Job {job_id} is in state {current_state}, expected one of {expected_states}"
        )
        self.job_id = job_id


class ModelNotFoundError(DomainError):
    def __init__(self, model_name: str):
        super().__init__(f"Model not available: {model_name}")
        self.model_name = model_name


class UnsupportedFormatError(DomainError):
    def __init__(self, format: str):
        super().__init__(f"Unsupported format: {format}")
        self.format = format


class FileSizeExceededError(DomainError):
    def __init__(self, size: int, max_size: int):
        super().__init__(f"File size {size} exceeds maximum {max_size}")
        self.size = size
        self.max_size = max_size
