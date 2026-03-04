"""Tests for S-1 melodic/bass patterns."""

import pytest

from mpump.patterns import GENRES, GENRE_NAMES, get_pattern

EXPECTED_GENRES = [
    "techno", "acid-techno", "trance", "dub-techno", "idm", "edm",
    "drum-and-bass", "house", "breakbeat", "jungle", "garage",
    "ambient", "glitch", "electro", "downtempo",
]


def test_all_genres_present():
    assert sorted(GENRES.keys()) == sorted(EXPECTED_GENRES)


def test_genre_names_matches_keys():
    assert GENRE_NAMES == list(GENRES.keys())


@pytest.mark.parametrize("genre", EXPECTED_GENRES)
def test_ten_patterns_per_genre(genre):
    patterns = GENRES[genre]
    assert len(patterns) >= 10, f"{genre} has {len(patterns)} patterns"


@pytest.mark.parametrize("genre", EXPECTED_GENRES)
def test_pattern_length_16(genre):
    for i, entry in enumerate(GENRES[genre]):
        name, desc, steps = entry
        assert len(steps) == 16, f"{genre}[{i}] '{name}' has {len(steps)} steps"


@pytest.mark.parametrize("genre", EXPECTED_GENRES)
def test_step_values_valid(genre):
    for i, (name, desc, steps) in enumerate(GENRES[genre]):
        for j, step in enumerate(steps):
            if step is None:
                continue
            assert isinstance(step, tuple), f"{genre}[{i}] step {j}: not a tuple"
            assert len(step) == 3, f"{genre}[{i}] step {j}: len={len(step)}"
            semitone, vel, slide = step
            assert isinstance(semitone, int), f"{genre}[{i}] step {j}: semitone not int"
            assert isinstance(vel, float), f"{genre}[{i}] step {j}: vel not float"
            assert isinstance(slide, bool), f"{genre}[{i}] step {j}: slide not bool"


@pytest.mark.parametrize("genre", EXPECTED_GENRES)
def test_velocity_factors(genre):
    valid_vels = {1.0, 1.3}
    for i, (name, desc, steps) in enumerate(GENRES[genre]):
        for j, step in enumerate(steps):
            if step is None:
                continue
            assert step[1] in valid_vels, (
                f"{genre}[{i}] step {j}: vel={step[1]} not in {valid_vels}"
            )


def test_get_pattern_valid():
    steps = get_pattern("techno", 1)
    assert len(steps) == 16


def test_get_pattern_last_index():
    steps = get_pattern("techno", 10)
    assert len(steps) == 16


def test_get_pattern_invalid_genre():
    with pytest.raises(ValueError, match="Unknown genre"):
        get_pattern("nonexistent", 1)


def test_get_pattern_index_zero():
    with pytest.raises(ValueError):
        get_pattern("techno", 0)


def test_get_pattern_index_too_high():
    with pytest.raises(ValueError):
        get_pattern("techno", 999)


@pytest.mark.parametrize("genre", EXPECTED_GENRES)
def test_pattern_names_are_strings(genre):
    for i, entry in enumerate(GENRES[genre]):
        name, desc, _ = entry
        assert isinstance(name, str) and len(name) > 0
        assert isinstance(desc, str) and len(desc) > 0
