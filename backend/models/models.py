from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    detections = relationship("Detection", back_populates="user", cascade="all, delete-orphan")


class Detection(Base):
    __tablename__ = "detections"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    image_filename = Column(String(255), nullable=False)
    original_image_path = Column(String(512), nullable=False)
    annotated_image_path = Column(String(512), nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    location_name = Column(String(255), nullable=True)
    total_objects = Column(Integer, default=0)
    detection_source = Column(String(10), nullable=False)  # "AI" or "DEMO"
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="detections")
    detected_objects = relationship(
        "DetectedObject", back_populates="detection", cascade="all, delete-orphan"
    )


class DetectedObject(Base):
    __tablename__ = "detected_objects"

    id = Column(Integer, primary_key=True, index=True)
    detection_id = Column(Integer, ForeignKey("detections.id"), nullable=False)
    plastic_type = Column(String(100), nullable=False)
    confidence = Column(Float, nullable=False)
    x_min = Column(Float, nullable=False)
    y_min = Column(Float, nullable=False)
    x_max = Column(Float, nullable=False)
    y_max = Column(Float, nullable=False)

    detection = relationship("Detection", back_populates="detected_objects")


class HotspotCleanup(Base):
    __tablename__ = "hotspot_cleanups"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    hotspot_key = Column(String(255), nullable=False, index=True)
    location_name = Column(String(255), nullable=False)
    center_lat = Column(Float, nullable=True)
    center_lon = Column(Float, nullable=True)
    status = Column(String(50), default="Pending", nullable=False)  # "Pending", "Inspection", "Cleanup Scheduled", "Cleaned"
    notes = Column(Text, nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship("User")
    history = relationship(
        "CleanupStatusHistory",
        back_populates="cleanup",
        cascade="all, delete-orphan",
        order_by="desc(CleanupStatusHistory.changed_at)",
    )


class CleanupStatusHistory(Base):
    __tablename__ = "cleanup_status_history"

    id = Column(Integer, primary_key=True, index=True)
    cleanup_id = Column(Integer, ForeignKey("hotspot_cleanups.id"), nullable=False)
    previous_status = Column(String(50), nullable=False)
    new_status = Column(String(50), nullable=False)
    changed_at = Column(DateTime(timezone=True), server_default=func.now())
    notes = Column(Text, nullable=True)

    cleanup = relationship("HotspotCleanup", back_populates="history")

