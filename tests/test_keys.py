"""Tests for key parsing."""

import pytest

from mpump.keys import (
    parse_key, valid_key_names,
    DEFAULT_KEY, DEFAULT_OCTAVE, OCTAVE_MIN, OCTAVE_MAX,
)

ALL_KEYS = ["C", "C#", "Db", "D", "D#", "Eb", "E", "F",
            "F#", "Gb", "G", "G#", "Ab", "A", "A#", "Bb", "B"]


@pytest.mark.parametrize("key", ALL_KEYS)
def test_all_keys_parse(key):
    note = parse_key(key)
    assert isinstance(note, int)
    assert 0 <= note <= 127


def test_enharmonic_equivalents():
    assert parse_key("C#") == parse_key("Db")
    assert parse_key("D#") == parse_key("Eb")
    assert parse_key("F#") == parse_key("Gb")
    assert parse_key("G#") == parse_key("Ab")
    assert parse_key("A#") == parse_key("Bb")


def test_case_insensitive():
    assert parse_key("a") == parse_key("A")
    assert parse_key("c#") == parse_key("C#")
    assert parse_key("bb") == parse_key("Bb")


def test_default_octave_2():
    assert parse_key("A") == 45  # A2


@pytest.mark.parametrize("octave", range(OCTAVE_MIN, OCTAVE_MAX + 1))
def test_octave_range_valid(octave):
    note = parse_key("A", octave)
    assert 0 <= note <= 127


def test_octave_shifts():
    base = parse_key("C", 2)
    assert parse_key("C", 3) == base + 12
    assert parse_key("C", 4) == base + 24


def test_invalid_key():
    with pytest.raises(ValueError, match="Unknown key"):
        parse_key("Z")


def test_invalid_octave_low():
    with pytest.raises(ValueError, match="out of range"):
        parse_key("A", -1)


def test_invalid_octave_high():
    with pytest.raises(ValueError, match="out of range"):
        parse_key("A", 7)


def test_valid_key_names_returns_all():
    names = valid_key_names()
    assert len(names) == 17  # 12 + 5 enharmonics
    assert "C" in names
    assert "Bb" in names


def test_midi_note_clamped():
    # Octave 0 with C should give MIDI 12 (C0)
    assert parse_key("C", 0) == 12
    # Octave 6 with B should give 107 (within 127)
    note = parse_key("B", 6)
    assert note <= 127
