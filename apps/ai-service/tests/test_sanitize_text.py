import importlib.util
import pathlib
import unittest


module_path = pathlib.Path(__file__).resolve().parents[1] / "main.py"
spec = importlib.util.spec_from_file_location("ai_service_main", module_path)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class SanitizationTests(unittest.TestCase):
    def test_removes_markdown_emphasis_wrappers(self):
        text = "This is **important** and __urgent__."
        self.assertEqual(module.sanitize_text_for_ui(text), "This is important and urgent.")

    def test_leaves_plain_text_unchanged(self):
        text = "This is plain text."
        self.assertEqual(module.sanitize_text_for_ui(text), text)


if __name__ == "__main__":
    unittest.main()
