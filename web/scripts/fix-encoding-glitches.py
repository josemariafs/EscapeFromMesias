from pathlib import Path
import re

css_path = Path(r"c:\Users\rames\Documents\Dev\EscapeFromGorditos\web\src\App.css")
text = css_path.read_text(encoding="utf-8", errors="surrogateescape")

pattern = re.compile(
    r"(\.task-table-collapsible summary::before \{\n  content: ')([^']*)(';)",
    re.MULTILINE,
)
new_text, n = pattern.subn(r"\1\\25B8\3", text)
if n != 1:
    raise SystemExit(f"expected 1 replacement, got {n}")

css_path.write_text(new_text, encoding="utf-8")
print("fixed summary::before content to \\25B8")

# Fix Spanish tableNoTasks if corrupted
tr_path = Path(r"c:\Users\rames\Documents\Dev\EscapeFromGorditos\web\src\i18n\translations.ts")
tr = tr_path.read_text(encoding="utf-8", errors="replace")
fixed = tr.replace(
    "tableNoTasks: 'Sin misiones en esta secci�n.'",
    "tableNoTasks: 'Sin misiones en esta sección.'",
)
# also try common mojibake of sección
fixed = fixed.replace(
    "tableNoTasks: 'Sin misiones en esta secciÃ³n.'",
    "tableNoTasks: 'Sin misiones en esta sección.'",
)
# Fix via regex any broken section word in that line
fixed2 = []
for line in fixed.splitlines(keepends=True):
    if "tableNoTasks:" in line and "Sin misiones" in line:
        line = "    tableNoTasks: 'Sin misiones en esta sección.',\n"
    fixed2.append(line)
tr_path.write_text("".join(fixed2), encoding="utf-8")
print("fixed tableNoTasks ES")
