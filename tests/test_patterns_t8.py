"""Tests for T-8 drum + bass patterns."""

import pytest

from mpump.patterns_t8 import (
    T8_DRUMS, T8_BASS, T8_GENRE_NAMES,
    get_t8_drum_pattern, get_t8_bass_pattern,
)

EXPECTED_GENRES = [
    "techno", "acid-techno", "trance", "dub-techno", "idm", "edm",
    "drum-and-bass", "house", "breakbeat", "jungle", "garage",
    "ambient", "glitch", "electro", "downtempo",
]

# T-8 MIDI note constants
VALID_DRUM_NOTES = {36, 37, 38, 42, 46, 47, 49, 50, 51, 56}
VALID_VELOCITIES = {47, 49, 60, 100, 120}


def test_all_genres_in_drums():
    assert sorted(T8_DRUMS.keys()) == sorted(EXPECTED_GENRES)


def test_all_genres_in_bass():
    assert sorted(T8_BASS.keys()) == sorted(EXPECTED_GENRES)


def test_genre_names_matches():
    assert T8_GENRE_NAMES == list(T8_DRUMS.keys())


@pytest.mark.parametrize("genre", EXPECTED_GENRES)
def test_ten_drum_patterns_per_genre(genre):
    assert len(T8_DRUMS[genre]) >= 10


@pytest.mark.parametrize("genre", EXPECTED_GENRES)
def test_drum_pattern_length_16(genre):
    for i, (name, desc, steps) in enumerate(T8_DRUMS[genre]):
        assert len(steps) == 16, f"{genre} drum[{i}] '{name}' has {len(steps)} steps"


@pytest.mark.parametrize("genre", EXPECTED_GENRES)
def test_drum_hits_valid_notes(genre):
    for i, (name, desc, steps) in enumerate(T8_DRUMS[genre]):
        for j, drum_step in enumerate(steps):
            for note, vel in drum_step:
                assert note in VALID_DRUM_NOTES, (
                    f"{genre} drum[{i}] step {j}: note {note} not valid"
                )


@pytest.mark.parametrize("genre", EXPECTED_GENRES)
def test_drum_hits_valid_velocities(genre):
    for i, (name, desc, steps) in enumerate(T8_DRUMS[genre]):
        for j, drum_step in enumerate(steps):
            for note, vel in drum_step:
                assert vel in VALID_VELOCITIES, (
                    f"{genre} drum[{i}] step {j}: vel {vel} not valid"
                )


@pytest.mark.parametrize("genre", EXPECTED_GENRES)
def test_bass_patterns_present(genre):
    assert len(T8_BASS[genre]) >= 1


@pytest.mark.parametrize("genre", EXPECTED_GENRES)
def test_bass_pattern_length_16(genre):
    for i, (name, desc, steps) in enumerate(T8_BASS[genre]):
        assert len(steps) == 16, f"{genre} bass[{i}] '{name}' has {len(steps)} steps"


@pytest.mark.parametrize("genre", EXPECTED_GENRES)
def test_bass_step_values_valid(genre):
    for i, (name, desc, steps) in enumerate(T8_BASS[genre]):
        for j, step in enumerate(steps):
            if step is None:
                continue
            assert isinstance(step, tuple) and len(step) == 3
            semitone, vel, slide = step
            assert isinstance(semitone, int)
            assert isinstance(vel, float)
            assert isinstance(slide, bool)


def test_get_t8_drum_pattern_valid():
    steps = get_t8_drum_pattern("techno", 1)
    assert len(steps) == 16


def test_get_t8_drum_pattern_invalid_genre():
    with pytest.raises(ValueError):
        get_t8_drum_pattern("nonexistent", 1)


def test_get_t8_drum_pattern_invalid_index():
    with pytest.raises(ValueError):
        get_t8_drum_pattern("techno", 0)


def test_get_t8_bass_pattern_valid():
    steps, desc = get_t8_bass_pattern("techno", 1)
    assert len(steps) == 16
    assert isinstance(desc, str)


def test_get_t8_bass_pattern_invalid_genre():
    with pytest.raises(ValueError):
        get_t8_bass_pattern("nonexistent", 1)
