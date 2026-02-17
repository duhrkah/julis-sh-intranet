"""DocumentAenderung model – eine konkrete Änderungsstelle innerhalb eines Änderungsantrags"""
from sqlalchemy import Column, Integer, String, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


class DocumentAenderung(Base):
    """Eine Stelle (z. B. § 3 Abs. 2) innerhalb eines Änderungsantrags mit alter/neuer Fassung und optionalem Änderungstext."""
    __tablename__ = "document_aenderungen"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    aenderungsantrag_id = Column(
        Integer,
        ForeignKey("document_aenderungsantraege.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    position = Column(Integer, nullable=False, default=0)  # Reihenfolge
    bezug = Column(String(255), nullable=True)  # z. B. "§ 3 Abs. 2", "Artikel 5"
    alte_fassung = Column(Text, nullable=True)
    neue_fassung = Column(Text, nullable=True)
    aenderungstext = Column(Text, nullable=True)  # Formulierter Änderungstext (gesetzesgleich)

    aenderungsantrag = relationship("DocumentAenderungsantrag", back_populates="stellen")
