"""Generate a sanitized client-safe PDF from a candidate profile.

The packet must NOT include:
  - email
  - phone
  - vendor name
  - internal notes

It MUST include:
  - candidate's full name (or initials, depending on policy — we use full name)
  - location, current title/company
  - summary, skills, experience years, notice period
  - sanitized "Tru Hyre" branding
"""
from __future__ import annotations

import io

from django.core.files.base import ContentFile
from django.utils import timezone


def _rl():
    """Import reportlab lazily so environments without Pillow can still boot."""
    from reportlab.lib.colors import HexColor
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import mm
    from reportlab.platypus import (
        Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle,
    )
    return {
        "HexColor": HexColor, "A4": A4, "ParagraphStyle": ParagraphStyle,
        "getSampleStyleSheet": getSampleStyleSheet, "mm": mm,
        "Paragraph": Paragraph, "SimpleDocTemplate": SimpleDocTemplate,
        "Spacer": Spacer, "Table": Table, "TableStyle": TableStyle,
    }


def _styles(rl):
    HexColor = rl["HexColor"]
    SLATE_900 = HexColor("#0f172a")
    SLATE_500 = HexColor("#64748b")
    BRAND = HexColor("#003781")
    ParagraphStyle = rl["ParagraphStyle"]
    base = rl["getSampleStyleSheet"]()["Normal"]
    return {
        "h1": ParagraphStyle("h1", parent=base, fontName="Helvetica-Bold", fontSize=18, leading=22, textColor=SLATE_900),
        "h2": ParagraphStyle("h2", parent=base, fontName="Helvetica-Bold", fontSize=11, leading=14, textColor=BRAND, spaceBefore=12, spaceAfter=4),
        "p":  ParagraphStyle("p",  parent=base, fontName="Helvetica", fontSize=10, leading=14, textColor=SLATE_900),
        "muted": ParagraphStyle("muted", parent=base, fontName="Helvetica", fontSize=9, leading=12, textColor=SLATE_500),
        "kpi_label": ParagraphStyle("kpi_label", parent=base, fontName="Helvetica", fontSize=8, leading=10, textColor=SLATE_500),
        "kpi_value": ParagraphStyle("kpi_value", parent=base, fontName="Helvetica-Bold", fontSize=11, leading=14, textColor=SLATE_900),
        "footer": ParagraphStyle("footer", parent=base, fontName="Helvetica", fontSize=7.5, leading=10, textColor=SLATE_500),
    }


def build_packet_bytes(candidate, *, site_name="Tru Hyre", tagline="An Allianz HR Platform - Project by Kris") -> bytes:
    rl = _rl()
    Paragraph, Table, TableStyle, Spacer = rl["Paragraph"], rl["Table"], rl["TableStyle"], rl["Spacer"]
    SimpleDocTemplate, A4, mm, HexColor = rl["SimpleDocTemplate"], rl["A4"], rl["mm"], rl["HexColor"]
    SLATE_200 = HexColor("#e2e8f0")
    SLATE_50 = HexColor("#f8fafc")

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=18*mm, rightMargin=18*mm,
        topMargin=16*mm, bottomMargin=16*mm,
        title=f"{site_name} · Candidate Packet",
        author=site_name,
    )
    st = _styles(rl)
    story: list = []

    header_tbl = Table(
        [[Paragraph(f"<b>{site_name}</b>", st["p"]), Paragraph(tagline, st["muted"])]],
        colWidths=[60*mm, None],
    )
    header_tbl.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), SLATE_50),
        ("BOX", (0,0), (-1,-1), 0.5, SLATE_200),
        ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
        ("LEFTPADDING", (0,0), (-1,-1), 8),
        ("RIGHTPADDING", (0,0), (-1,-1), 8),
        ("TOPPADDING", (0,0), (-1,-1), 6),
        ("BOTTOMPADDING", (0,0), (-1,-1), 6),
        ("ALIGN", (1,0), (1,0), "RIGHT"),
    ]))
    story.append(header_tbl)
    story.append(Spacer(1, 8))

    story.append(Paragraph(candidate.full_name, st["h1"]))
    title_bits = []
    if candidate.current_title:
        title_bits.append(candidate.current_title)
    if candidate.current_company:
        title_bits.append(candidate.current_company)
    if candidate.location:
        title_bits.append(candidate.location)
    story.append(Paragraph(" · ".join(title_bits) or "Profile", st["muted"]))

    yrs = f"{candidate.total_experience_years} yrs" if candidate.total_experience_years else "—"
    notice = f"{candidate.notice_period_days} days" if candidate.notice_period_days is not None else "—"
    cur_ctc = f"{candidate.ctc_currency} {candidate.current_ctc:,.0f}" if candidate.current_ctc else "—"
    exp_ctc = f"{candidate.ctc_currency} {candidate.expected_ctc:,.0f}" if candidate.expected_ctc else "—"

    kpi = Table(
        [[
            Paragraph("Experience", st["kpi_label"]), Paragraph("Notice", st["kpi_label"]),
            Paragraph("Current CTC", st["kpi_label"]), Paragraph("Expected CTC", st["kpi_label"]),
        ], [
            Paragraph(yrs, st["kpi_value"]), Paragraph(notice, st["kpi_value"]),
            Paragraph(cur_ctc, st["kpi_value"]), Paragraph(exp_ctc, st["kpi_value"]),
        ]],
        colWidths=[40*mm, 35*mm, 45*mm, 45*mm],
    )
    kpi.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), SLATE_50),
        ("BOX", (0,0), (-1,-1), 0.5, SLATE_200),
        ("INNERGRID", (0,0), (-1,-1), 0.5, SLATE_200),
        ("LEFTPADDING", (0,0), (-1,-1), 8),
        ("RIGHTPADDING", (0,0), (-1,-1), 8),
        ("TOPPADDING", (0,0), (-1,-1), 6),
        ("BOTTOMPADDING", (0,0), (-1,-1), 6),
    ]))
    story.append(Spacer(1, 8))
    story.append(kpi)

    if candidate.summary:
        story.append(Paragraph("Summary", st["h2"]))
        story.append(Paragraph(candidate.summary.replace("\n", "<br/>"), st["p"]))

    if candidate.skills_list:
        story.append(Paragraph("Skills", st["h2"]))
        story.append(Paragraph(" · ".join(candidate.skills_list), st["p"]))

    story.append(Paragraph("Reference", st["h2"]))
    ref_rows = [
        [Paragraph("Candidate ID", st["kpi_label"]), Paragraph(f"TRU-C{candidate.pk:06d}", st["kpi_value"])],
        [Paragraph("Prepared on", st["kpi_label"]), Paragraph(timezone.now().strftime("%d %b %Y, %H:%M"), st["kpi_value"])],
    ]
    ref_tbl = Table(ref_rows, colWidths=[40*mm, None])
    ref_tbl.setStyle(TableStyle([
        ("VALIGN", (0,0), (-1,-1), "TOP"),
        ("BOTTOMPADDING", (0,0), (-1,-1), 4),
    ]))
    story.append(ref_tbl)

    story.append(Spacer(1, 14))
    story.append(Paragraph(
        f"<i>Confidential candidate packet generated by {site_name}. "
        f"Personal contact details and sourcing information have been redacted "
        f"to protect candidate privacy.</i>",
        st["footer"],
    ))

    doc.build(story)
    return buf.getvalue()


def generate_and_attach_packet(candidate, *, by=None) -> "ClientPacket":
    from .models import ClientPacket
    pdf_bytes = build_packet_bytes(candidate)
    fname = f"packet-{candidate.pk}-{timezone.now():%Y%m%d-%H%M%S}.pdf"
    packet = ClientPacket(candidate=candidate, generated_by=by)
    packet.file.save(fname, ContentFile(pdf_bytes), save=True)
    return packet
