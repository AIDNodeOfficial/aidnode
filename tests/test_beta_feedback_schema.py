"""Regression test for five-tool feedback schema compatibility.

Run: python3 -m unittest discover -s tests -p 'test_beta_feedback_schema.py'
No network, Cloudflare credentials, or production database required.
This test intentionally fails against the current schema until a migration is designed.
"""
from pathlib import Path
import sqlite3
import unittest

SCHEMA = Path(__file__).resolve().parents[1] / "migrations" / "0000_schema.sql"


class FeedbackSchemaTest(unittest.TestCase):
    def test_all_five_tools_have_feedback_labels(self):
        sql = SCHEMA.read_text(encoding="utf-8")
        db = sqlite3.connect(":memory:")
        try:
            db.executescript(sql)
            db.execute(
                "INSERT INTO accounts (id,name,api_key_hash) VALUES (?,?,?)",
                ("test-operator", "test", "dummy-hash"),
            )
            for i, service in enumerate(
                ("repair", "verify", "witness", "monitor", "recovery", "overall")
            ):
                with self.subTest(service=service):
                    db.execute(
                        """INSERT INTO beta_feedback
                        (id,account_id,checkpoint,service,helpful,would_reuse,
                         would_pay_half_cent,outcome,comment)
                        VALUES (?,?,?,?,?,?,?,?,?)""",
                        (
                            f"feedback-{i}", "test-operator", 10, service,
                            "unsure", "unsure", "unsure", "not_applicable", "",
                        ),
                    )
        finally:
            db.close()

    def test_unknown_feedback_service_is_rejected(self):
        db = sqlite3.connect(":memory:")
        try:
            db.executescript(SCHEMA.read_text(encoding="utf-8"))
            db.execute(
                "INSERT INTO accounts (id,name,api_key_hash) VALUES (?,?,?)",
                ("test-operator", "test", "dummy-hash"),
            )
            with self.assertRaises(sqlite3.IntegrityError):
                db.execute(
                    """INSERT INTO beta_feedback
                    (id,account_id,checkpoint,service,helpful,would_reuse,
                     would_pay_half_cent,outcome)
                    VALUES (?,?,?,?,?,?,?,?)""",
                    (
                        "bad-feedback", "test-operator", 10, "unknown_tool",
                        "unsure", "unsure", "unsure", "not_applicable",
                    ),
                )
        finally:
            db.close()


if __name__ == "__main__":
    unittest.main()
