"""
Builds the lesson-plan fixtures used by the plan-import tests (docx via python-docx, the other
formats through LibreOffice). Run once; the generated files are committed.

    python3 e2e/fixtures/generate.py
"""
import subprocess, pathlib
from docx import Document
from docx.shared import Pt, Cm
from docx.enum.section import WD_ORIENT

HERE = pathlib.Path(__file__).parent

# weekly plan of the sample teacher: (lesson no, time, [class per weekday Pn..Pt])
WEEK = [
    (1, "07:45-08:30", ["1TA", "2TB", "",    "3TE", "4TB"]),
    (2, "08:40-09:25", ["1TA", "3TE", "5TI", "",    "4TB"]),
    (3, "09:35-10:20", ["3TE", "4TA", "5TI", "3TE", ""]),
    (4, "10:30-11:15", ["3TE", "",    "1TA", "3TE", ""]),
    (5, "11:25-12:10", ["5TI", "2TB", "",    "",    ""]),
]
DAYS = ["Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek"]


def week_doc(path):
    d = Document()
    sec = d.sections[0]
    sec.orientation = WD_ORIENT.LANDSCAPE
    sec.page_width, sec.page_height = sec.page_height, sec.page_width
    d.add_heading("Plan lekcji nauczyciela — matematyka", level=1)
    t = d.add_table(rows=1, cols=6)
    t.style = "Table Grid"
    for i, h in enumerate(["Godz."] + DAYS):
        t.rows[0].cells[i].text = h
    for no, time, row in WEEK:
        cells = t.add_row().cells
        cells[0].text = f"{no}\n{time}"
        for i, klass in enumerate(row):
            cells[i + 1].text = f"Matematyka\n{klass}\ns. {10 + no}" if klass else ""
    for row in t.rows:
        for c in row.cells:
            for p in c.paragraphs:
                for r in p.runs:
                    r.font.size = Pt(11)
    d.save(path)


def day_doc(path, day_index):
    d = Document()
    d.add_heading(f"Plan lekcji — {DAYS[day_index].lower()}", level=1)
    t = d.add_table(rows=1, cols=4)
    t.style = "Table Grid"
    for i, h in enumerate(["Nr", "Czas", "Przedmiot", "Klasa"]):
        t.rows[0].cells[i].text = h
    for no, time, row in WEEK:
        if row[day_index]:
            cells = t.add_row().cells
            cells[0].text = str(no)
            cells[1].text = time
            cells[2].text = "Matematyka"
            cells[3].text = row[day_index]
    d.save(path)


week_doc(HERE / "plan-tydzien.docx")
day_doc(HERE / "plan-poniedzialek.docx", 0)
day_doc(HERE / "plan-wtorek.docx", 1)

for name, fmt in [("plan-tydzien", "doc"), ("plan-tydzien", "pdf"), ("plan-poniedzialek", "pdf"), ("plan-poniedzialek", "doc")]:
    subprocess.run(["soffice", "-env:UserInstallation=file:///tmp/lo-profile", "--headless", "--convert-to", fmt, "--outdir", str(HERE), str(HERE / f"{name}.docx")], check=True, capture_output=True)

# pictures of the documents (first page) for the OCR tests
for name in ["plan-tydzien", "plan-poniedzialek"]:
    subprocess.run(["pdftoppm", "-r", "110", "-png", "-singlefile", str(HERE / f"{name}.pdf"), str(HERE / name)], check=True)
print("ok")
