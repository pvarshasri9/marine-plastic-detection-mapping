"""
Plastic Hotspot Intelligence Service.

System-generated cleanup priority based on recorded observations.
This is NOT a scientifically validated environmental risk model.
No hallucinated or fabricated environmental claims.

Methodology:
1. Groups observations by geographic proximity (Haversine distance <= HOTSPOT_RADIUS_KM).
   If coordinates are absent, groups by location name.
2. Calculates a deterministic priority score (0-100) from 5 transparent factors:
   - Object Volume (35%)
   - Observation Frequency (25%)
   - Recency of Activity (20%)
   - Persistence / Repeat Frequency (10%)
   - High-Impact Material Weight (10%)
3. Classifies priority as LOW (<35), MEDIUM (35-64), or HIGH (>=65).
4. Evaluates trend (Increasing, Stable, Decreasing, Insufficient Data) using real historical records.
5. Manages non-destructive cleanup status workflows with full audit history.
"""

import math
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from models.models import Detection, DetectedObject, HotspotCleanup, CleanupStatusHistory
from config import HOTSPOT_RADIUS_KM, MIN_OBSERVATIONS


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


HIGH_IMPACT_CATEGORIES = {"fishing_net", "plastic_container", "foam", "rope"}


def _calculate_priority(
    total_objects: int,
    observation_count: int,
    days_since_latest: float,
    days_span: float,
    high_impact_ratio: float,
) -> Dict[str, Any]:
    """
    Deterministic priority score calculation (0 - 100).
    All component weights and normalization factors are explicitly documented.
    """
    # 1. Object Volume Score (35 pts max) — Normalized to 20 objects
    volume_score = min(total_objects / 20.0, 1.0) * 35.0

    # 2. Observation Frequency Score (25 pts max) — Normalized to 5 observations
    freq_score = min(observation_count / 5.0, 1.0) * 25.0

    # 3. Recency Score (20 pts max) — Detections observed recently receive higher cleanup urgency
    if days_since_latest <= 7:
        recency_score = 20.0
    elif days_since_latest <= 14:
        recency_score = 15.0
    elif days_since_latest <= 30:
        recency_score = 10.0
    elif days_since_latest <= 60:
        recency_score = 5.0
    else:
        recency_score = 2.0

    # 4. Persistence Score (10 pts max) — Repeated recurrence over time
    if observation_count >= 2:
        if days_span >= 7.0:
            persistence_score = 10.0
        else:
            persistence_score = 7.0
    else:
        persistence_score = 2.0

    # 5. High-Impact Category Weight (10 pts max)
    impact_score = high_impact_ratio * 10.0

    total_score = round(volume_score + freq_score + recency_score + persistence_score + impact_score, 1)
    total_score = max(0.0, min(100.0, total_score))

    if total_score >= 65.0:
        level = "HIGH"
    elif total_score >= 35.0:
        level = "MEDIUM"
    else:
        level = "LOW"

    return {
        "score": total_score,
        "level": level,
        "breakdown": {
            "volume_score": round(volume_score, 1),
            "frequency_score": round(freq_score, 1),
            "recency_score": round(recency_score, 1),
            "persistence_score": round(persistence_score, 1),
            "impact_score": round(impact_score, 1),
        },
    }


def _calculate_trend(detections: List[Detection]) -> Dict[str, str]:
    """
    Trend analysis calculated only when >= 3 historical observations exist.
    """
    if len(detections) < 3:
        return {
            "status": "Insufficient Data",
            "symbol": "—",
            "description": "Insufficient historical observations to determine a trend (minimum 3 required).",
        }

    sorted_dets = sorted(detections, key=lambda d: d.created_at)
    half = len(sorted_dets) // 2
    early_half = sorted_dets[:half]
    late_half = sorted_dets[half:]

    early_avg = sum(d.total_objects for d in early_half) / max(len(early_half), 1)
    late_avg = sum(d.total_objects for d in late_half) / max(len(late_half), 1)

    if late_avg > early_avg * 1.15:
        return {
            "status": "Increasing",
            "symbol": "↗",
            "description": f"Observed debris counts rose from an earlier average of {early_avg:.1f} to {late_avg:.1f} objects per observation.",
        }
    elif late_avg < early_avg * 0.85:
        return {
            "status": "Decreasing",
            "symbol": "↘",
            "description": f"Observed debris counts decreased from an earlier average of {early_avg:.1f} to {late_avg:.1f} objects per observation.",
        }
    else:
        return {
            "status": "Stable",
            "symbol": "→",
            "description": f"Observed debris counts remain steady (earlier avg: {early_avg:.1f}, recent avg: {late_avg:.1f}).",
        }


def _generate_explanation(
    level: str,
    total_objects: int,
    obs_count: int,
    days_since_latest: float,
    top_types: List[str],
) -> str:
    """Generate dynamic, factual explanation strictly based on database values."""
    if days_since_latest < 1.0:
        recency_text = "observed within the last 24 hours"
    elif days_since_latest <= 7.0:
        recency_text = f"observed {int(days_since_latest)} days ago"
    elif days_since_latest <= 30.0:
        recency_text = f"last observed {int(days_since_latest)} days ago"
    else:
        recency_text = f"last observed over {int(days_since_latest // 30)} month(s) ago"

    types_str = f" with {', '.join(t.replace('_', ' ') for t in top_types)}" if top_types else ""

    if obs_count >= 2:
        return (
            f"System Priority {level}: {total_objects} plastic objects were recorded across "
            f"{obs_count} observations at this location, {recency_text}{types_str}."
        )
    else:
        return (
            f"System Priority {level}: {total_objects} plastic objects were recorded in 1 observation "
            f"({recency_text}{types_str}). Insufficient historical observations to determine a recurrence trend."
        )


def compute_hotspots(db: Session, user_id: int) -> Dict[str, Any]:
    """
    Computes Hotspot Intelligence from the user's real detection observations.
    """
    all_detections = (
        db.query(Detection)
        .filter(Detection.user_id == user_id)
        .order_by(Detection.created_at.desc())
        .all()
    )

    if not all_detections:
        return {
            "hotspots": [],
            "summary": {
                "total_hotspots": 0,
                "high_priority": 0,
                "medium_priority": 0,
                "low_priority": 0,
                "total_objects_in_hotspots": 0,
                "total_observations": 0,
                "status_breakdown": {
                    "Pending": 0,
                    "Inspection": 0,
                    "Cleanup Scheduled": 0,
                    "Cleaned": 0,
                },
                "demo_records_count": 0,
                "ai_records_count": 0,
                "all_demo": False,
                "insufficient_location_count": 0,
            },
            "scoring_methodology": {
                "max_score": 100,
                "thresholds": {"HIGH": ">= 65", "MEDIUM": "35 - 64", "LOW": "< 35"},
                "factors": [
                    {"name": "Object Volume", "weight": "35%", "description": "Total volume of observed debris (scaled to 20 objects)."},
                    {"name": "Observation Frequency", "weight": "25%", "description": "Number of recorded observations at this location."},
                    {"name": "Recency of Activity", "weight": "20%", "description": "Days since the most recent observation in this cluster."},
                    {"name": "Persistence / Repeat", "weight": "10%", "description": "Observation spread over time indicating recurring accumulation."},
                    {"name": "High-Impact Categories", "weight": "10%", "description": "Proportion of fishing gear, foam, and heavy rigid containers."},
                ],
            },
            "disclaimer": "System-generated cleanup priority based on recorded observations. Not an official environmental risk score.",
        }

    # Separate detections with coordinates, with location_name only, or neither
    coord_dets: List[Detection] = []
    named_dets: List[Detection] = []
    insufficient_location_count = 0

    for d in all_detections:
        if d.latitude is not None and d.longitude is not None:
            coord_dets.append(d)
        elif d.location_name and d.location_name.strip():
            named_dets.append(d)
        else:
            insufficient_location_count += 1

    clusters: List[List[Detection]] = []

    # 1. Geographic clustering for detections with coordinates
    assigned_coords = [False] * len(coord_dets)
    for i, d1 in enumerate(coord_dets):
        if assigned_coords[i]:
            continue
        cluster = [d1]
        assigned_coords[i] = True
        for j, d2 in enumerate(coord_dets):
            if assigned_coords[j]:
                continue
            dist = _haversine_km(d1.latitude, d1.longitude, d2.latitude, d2.longitude)
            if dist <= HOTSPOT_RADIUS_KM:
                cluster.append(d2)
                assigned_coords[j] = True
        clusters.append(cluster)

    # 2. Name-based grouping for detections without coordinates
    name_groups: Dict[str, List[Detection]] = {}
    for d in named_dets:
        key = d.location_name.strip().lower()
        name_groups.setdefault(key, []).append(d)

    for group in name_groups.values():
        clusters.append(group)

    # Pre-fetch existing cleanups for this user
    cleanups = db.query(HotspotCleanup).filter(HotspotCleanup.user_id == user_id).all()
    cleanup_map: Dict[str, HotspotCleanup] = {c.hotspot_key: c for c in cleanups}

    now = datetime.now(timezone.utc)
    hotspots = []
    total_demo_count = 0
    total_ai_count = 0

    for cluster in clusters:
        # Determine center coordinates or None
        coords_in_cluster = [d for d in cluster if d.latitude is not None and d.longitude is not None]
        if coords_in_cluster:
            center_lat = round(sum(d.latitude for d in coords_in_cluster) / len(coords_in_cluster), 5)
            center_lon = round(sum(d.longitude for d in coords_in_cluster) / len(coords_in_cluster), 5)
            hotspot_key = f"coord_{round(center_lat, 2)}_{round(center_lon, 2)}"
        else:
            center_lat = None
            center_lon = None
            loc_name = cluster[0].location_name or "Unknown Location"
            hotspot_key = f"loc_{loc_name.lower().replace(' ', '_')}"

        # Determine location name
        loc_names = [d.location_name for d in cluster if d.location_name and d.location_name.strip()]
        if loc_names:
            location_name = max(set(loc_names), key=loc_names.count)
        elif center_lat is not None and center_lon is not None:
            location_name = f"Zone ({center_lat:.3f}, {center_lon:.3f})"
        else:
            location_name = "Unspecified Shoreline"

        total_objects = sum(d.total_objects for d in cluster)
        obs_count = len(cluster)

        # Dates & recency
        dates = sorted([d.created_at for d in cluster if d.created_at])
        if dates:
            first_obs = dates[0]
            latest_obs = dates[-1]
            # Ensure timezone awareness for comparison
            latest_tz = latest_obs.replace(tzinfo=timezone.utc) if latest_obs.tzinfo is None else latest_obs
            first_tz = first_obs.replace(tzinfo=timezone.utc) if first_obs.tzinfo is None else first_obs
            days_since_latest = max(0.0, (now - latest_tz).total_seconds() / 86400.0)
            days_span = max(0.0, (latest_tz - first_tz).total_seconds() / 86400.0)
        else:
            first_obs = None
            latest_obs = None
            days_since_latest = 999.0
            days_span = 0.0

        # Gather detected objects
        det_ids = [d.id for d in cluster]
        objects = (
            db.query(DetectedObject)
            .filter(DetectedObject.detection_id.in_(det_ids))
            .all()
        )

        type_counts: Dict[str, int] = {}
        high_impact_count = 0
        for obj in objects:
            type_counts[obj.plastic_type] = type_counts.get(obj.plastic_type, 0) + 1
            if obj.plastic_type in HIGH_IMPACT_CATEGORIES:
                high_impact_count += 1

        top_types = sorted(type_counts.keys(), key=lambda k: type_counts[k], reverse=True)[:3]
        high_impact_ratio = (high_impact_count / len(objects)) if objects else 0.0

        # Priority calculation
        priority_info = _calculate_priority(
            total_objects=total_objects,
            observation_count=obs_count,
            days_since_latest=days_since_latest,
            days_span=days_span,
            high_impact_ratio=high_impact_ratio,
        )

        # Trend analysis
        trend_info = _calculate_trend(cluster)

        # Explanation
        why_explanation = _generate_explanation(
            level=priority_info["level"],
            total_objects=total_objects,
            obs_count=obs_count,
            days_since_latest=days_since_latest,
            top_types=top_types,
        )

        # Check existing cleanup status record
        cleanup_record = cleanup_map.get(hotspot_key)
        cleanup_status = cleanup_record.status if cleanup_record else "Pending"
        cleanup_notes = cleanup_record.notes if cleanup_record else ""
        cleanup_history = []
        if cleanup_record:
            cleanup_history = [
                {
                    "id": h.id,
                    "previous_status": h.previous_status,
                    "new_status": h.new_status,
                    "changed_at": h.changed_at.isoformat() if h.changed_at else None,
                    "notes": h.notes,
                }
                for h in cleanup_record.history
            ]

        # Count sources
        demo_in_cluster = sum(1 for d in cluster if d.detection_source == "DEMO")
        ai_in_cluster = sum(1 for d in cluster if d.detection_source == "AI")
        total_demo_count += demo_in_cluster
        total_ai_count += ai_in_cluster

        # Observations detail list
        observations_list = []
        for d in sorted(cluster, key=lambda x: x.created_at if x.created_at else datetime.min, reverse=True):
            d_objs = [o.plastic_type for o in objects if o.detection_id == d.id]
            observations_list.append({
                "id": d.id,
                "date": d.created_at.isoformat() if d.created_at else None,
                "total_objects": d.total_objects,
                "location_name": d.location_name,
                "latitude": d.latitude,
                "longitude": d.longitude,
                "detection_source": d.detection_source,
                "image_filename": d.image_filename,
                "original_image_path": d.original_image_path,
                "plastic_types": list(set(d_objs)),
            })

        hotspots.append({
            "hotspot_key": hotspot_key,
            "location_name": location_name,
            "center_lat": center_lat,
            "center_lon": center_lon,
            "has_coordinates": center_lat is not None and center_lon is not None,
            "total_objects": total_objects,
            "observation_count": obs_count,
            "priority": priority_info["level"],
            "priority_level": priority_info["level"],
            "priority_score": priority_info["score"],
            "score_breakdown": priority_info["breakdown"],
            "explanation": why_explanation,
            "trend": trend_info["status"],
            "trend_symbol": trend_info["symbol"],
            "trend_description": trend_info["description"],
            "first_observed": first_obs.isoformat() if first_obs else None,
            "latest_observed": latest_obs.isoformat() if latest_obs else None,
            "days_since_latest": round(days_since_latest, 1) if days_since_latest < 900 else None,
            "top_plastic_types": top_types,
            "cleanup_status": cleanup_status,
            "cleanup_notes": cleanup_notes,
            "cleanup_history": cleanup_history,
            "demo_count": demo_in_cluster,
            "ai_count": ai_in_cluster,
            "observations": observations_list,
        })

    # Sort hotspots by Priority Score descending (Rank #1 is highest priority)
    hotspots.sort(key=lambda h: (h["priority_score"], h["total_objects"]), reverse=True)
    for idx, h in enumerate(hotspots, 1):
        h["rank"] = idx

    # Summary metrics
    high_count = sum(1 for h in hotspots if h["priority"] == "HIGH")
    med_count = sum(1 for h in hotspots if h["priority"] == "MEDIUM")
    low_count = sum(1 for h in hotspots if h["priority"] == "LOW")
    total_objects_all = sum(h["total_objects"] for h in hotspots)
    total_obs_all = sum(h["observation_count"] for h in hotspots)

    status_breakdown = {"Pending": 0, "Inspection": 0, "Cleanup Scheduled": 0, "Cleaned": 0}
    for h in hotspots:
        status_breakdown[h["cleanup_status"]] = status_breakdown.get(h["cleanup_status"], 0) + 1

    return {
        "hotspots": hotspots,
        "summary": {
            "total_hotspots": len(hotspots),
            "high_priority": high_count,
            "medium_priority": med_count,
            "low_priority": low_count,
            "total_objects_in_hotspots": total_objects_all,
            "total_observations": total_obs_all,
            "status_breakdown": status_breakdown,
            "demo_records_count": total_demo_count,
            "ai_records_count": total_ai_count,
            "all_demo": total_demo_count > 0 and total_ai_count == 0,
            "insufficient_location_count": insufficient_location_count,
        },
        "config": {
            "radius_km": HOTSPOT_RADIUS_KM,
            "min_observations": MIN_OBSERVATIONS,
        },
        "scoring_methodology": {
            "max_score": 100,
            "thresholds": {"HIGH": ">= 65", "MEDIUM": "35 - 64", "LOW": "< 35"},
            "factors": [
                {"name": "Object Volume", "weight": "35%", "description": "Total volume of observed debris (scaled to 20 objects)."},
                {"name": "Observation Frequency", "weight": "25%", "description": "Number of recorded observations at this location."},
                {"name": "Recency of Activity", "weight": "20%", "description": "Days since the most recent observation in this cluster."},
                {"name": "Persistence / Repeat", "weight": "10%", "description": "Observation spread over time indicating recurring accumulation."},
                {"name": "High-Impact Categories", "weight": "10%", "description": "Proportion of fishing gear, foam, and heavy rigid containers."},
            ],
        },
        "disclaimer": "System-generated cleanup priority based on recorded observations. Not an official environmental risk score.",
    }


def update_cleanup_status(
    db: Session,
    user_id: int,
    hotspot_key: str,
    location_name: str,
    center_lat: Optional[float],
    center_lon: Optional[float],
    new_status: str,
    notes: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Updates the cleanup status of a hotspot without touching or modifying the original detection records.
    Maintains a full audit history log in cleanup_status_history.
    """
    valid_statuses = ("Pending", "Inspection", "Cleanup Scheduled", "Cleaned")
    if new_status not in valid_statuses:
        raise ValueError(f"Invalid status '{new_status}'. Allowed: {', '.join(valid_statuses)}")

    cleanup = (
        db.query(HotspotCleanup)
        .filter(HotspotCleanup.user_id == user_id, HotspotCleanup.hotspot_key == hotspot_key)
        .first()
    )

    if not cleanup:
        cleanup = HotspotCleanup(
            user_id=user_id,
            hotspot_key=hotspot_key,
            location_name=location_name,
            center_lat=center_lat,
            center_lon=center_lon,
            status="Pending",
            notes=notes,
        )
        db.add(cleanup)
        db.flush()

    previous_status = cleanup.status
    cleanup.status = new_status
    if notes is not None:
        cleanup.notes = notes

    # Add audit entry if status changed
    history_entry = CleanupStatusHistory(
        cleanup_id=cleanup.id,
        previous_status=previous_status,
        new_status=new_status,
        notes=notes,
    )
    db.add(history_entry)
    db.commit()
    db.refresh(cleanup)

    return {
        "hotspot_key": cleanup.hotspot_key,
        "location_name": cleanup.location_name,
        "status": cleanup.status,
        "notes": cleanup.notes,
        "updated_at": cleanup.updated_at.isoformat() if cleanup.updated_at else None,
        "history": [
            {
                "id": h.id,
                "previous_status": h.previous_status,
                "new_status": h.new_status,
                "changed_at": h.changed_at.isoformat() if h.changed_at else None,
                "notes": h.notes,
            }
            for h in cleanup.history
        ],
    }
