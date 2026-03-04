"""Tests for J-6 chord progression patterns."""

import pytest

from mpump.patterns_j6 import (
    J6_GENRES, J6_GENRE_NAMES, J6_CHORD_SETS,
    get_j6_pattern, get_j6_chord_set,
)

EXPECTED_GENRES = [
    "techno", "acid-techno", "trance", "dub-techno", "idm", "edm",
    "drum-and-bass", "house", "breakbeat", "jungle", "garage",
    "ambient", "glitch", "electro", "downtempo",
]


def test_all_genres_present():
    assert sorted(J6_GENRES.keys()) == sorted(EXPECTED_GENRES)


def test_genre_names_matches():
    assert J6_GENRE_NAMES == list(J6_GENRES.keys())


@pytest.mark.parametrize("genre", EXPECTED_GENRES)
def test_ten_patterns_per_genre(genre):
    assert len(J6_GENRES[genre]) >= 10


@pytest.mark.parametrize("genre", EXPECTED_GENRES)
def test_pattern_length_16(genre):
    for i, (name, desc, steps) in enumerate(J6_GENRES[genre]):
        assert len(steps) == 16, f"{genre}[{i}] '{name}' has {len(steps)} steps"


@pytest.mark.parametrize("genre", EXPECTED_GENRES)
def test_chord_offsets_in_range(genre):
    for i, (name, desc, steps) in enumerate(J6_GENRES[genre]):
        for j, step in enumerate(steps):
            if step is None:
                continue
            offset = step[0]
            assert 0 <= offset <= 11, (
                f"{genre}[{i}] step {j}: offset {offset} not in 0-11"
            )


@pytest.mark.parametrize("genre", EXPECTED_GENRES)
def test_step_values_valid(genre):
    for i, (name, desc, steps) in enumerate(J6_GENRES[genre]):
        for j, step in enumerate(steps):
            if step is None:
                continue
            assert isinstance(step, tuple) and len(step) == 3
            offset, vel, slide = step
            assert isinstance(offset, int)
            assert isinstance(vel, (int, float))
            assert isinstance(slide, bool)


@pytest.mark.parametrize("genre", EXPECTED_GENRES)
def test_velocity_factors(genre):
    # A=9 (semitone shortcut) shadows A=1.25 (accent) in patterns_j6,
    # so velocity values are {1.0, 9} in practice.
    valid_vels = {1.0, 9}
    for i, (name, desc, steps) in enumerate(J6_GENRES[genre]):
        for j, step in enumerate(steps):
            if step is None:
                continue
            assert step[1] in valid_vels, (
                f"{genre}[{i}] step {j}: vel={step[1]} not in {valid_vels}"
            )


def test_all_genres_have_chord_sets():
    assert sorted(J6_CHORD_SETS.keys()) == sorted(EXPECTED_GENRES)


@pytest.mark.parametrize("genre", EXPECTED_GENRES)
def test_chord_set_values_in_range(genre):
    cs = J6_CHORD_SETS[genre]
    assert 1 <= cs <= 100, f"{genre}: chord set {cs} not in 1-100"


def test_get_j6_pattern_valid():
    steps = get_j6_pattern("techno", 1)
    assert len(steps) == 16


def test_get_j6_pattern_invalid_genre():
    with pytest.raises(ValueError):
        get_j6_pattern("nonexistent", 1)


def test_get_j6_pattern_invalid_index():
    with pytest.raises(ValueError):
        get_j6_pattern("techno", 0)


def test_get_j6_chord_set_valid():
    cs = get_j6_chord_set("techno")
    assert isinstance(cs, int)
    assert 1 <= cs <= 100
