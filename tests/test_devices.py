"""Tests for device registry."""

import pytest

from mpump.devices import (
    DEVICE_REGISTRY, DeviceConfig,
    get_device, find_device,
)

VALID_MODES = {"synth", "drums", "drums+bass"}


def test_exactly_50_devices():
    assert len(DEVICE_REGISTRY) == 50


def test_all_ids_unique():
    ids = [d.id for d in DEVICE_REGISTRY]
    assert len(ids) == len(set(ids)), f"Duplicate IDs: {[x for x in ids if ids.count(x) > 1]}"


@pytest.mark.parametrize("dev", DEVICE_REGISTRY, ids=lambda d: d.id)
def test_valid_mode(dev):
    assert dev.mode in VALID_MODES, f"{dev.id}: mode={dev.mode}"


@pytest.mark.parametrize("dev", DEVICE_REGISTRY, ids=lambda d: d.id)
def test_valid_channel(dev):
    assert 0 <= dev.channel <= 15, f"{dev.id}: channel={dev.channel}"


@pytest.mark.parametrize("dev", DEVICE_REGISTRY, ids=lambda d: d.id)
def test_has_required_fields(dev):
    assert isinstance(dev.id, str) and len(dev.id) > 0
    assert isinstance(dev.label, str) and len(dev.label) > 0
    assert isinstance(dev.port_match, str) and len(dev.port_match) > 0


@pytest.mark.parametrize("dev", DEVICE_REGISTRY, ids=lambda d: d.id)
def test_drums_bass_has_bass_channel(dev):
    if dev.mode == "drums+bass":
        assert dev.bass_channel is not None, f"{dev.id}: drums+bass missing bass_channel"
        assert 0 <= dev.bass_channel <= 15


def test_get_device_known():
    dev = get_device("s1")
    assert dev is not None
    assert dev.label == "S-1"


def test_get_device_unknown():
    assert get_device("nonexistent") is None


def test_find_device_by_port():
    dev = find_device("S-1 MIDI 1")
    assert dev is not None
    assert dev.id == "s1"


def test_find_device_no_match():
    assert find_device("UNKNOWN_PORT_12345") is None
