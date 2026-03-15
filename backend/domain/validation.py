import re

_JOB_ID_RE = re.compile(r"^[a-f0-9]{32}$")


def validate_job_id(job_id: str) -> str:
    """Validate that a job_id is a valid UUID4 hex string.

    Returns the job_id if valid, raises ValueError otherwise.
    """
    if not _JOB_ID_RE.match(job_id):
        raise ValueError(f"Invalid job ID format: {job_id!r}")
    return job_id
