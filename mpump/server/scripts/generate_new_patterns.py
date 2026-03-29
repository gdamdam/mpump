#!/usr/bin/env python3
"""Generate 10 new patterns per genre for mpump groovebox.

Appends to existing JSON data files and catalog.
Each genre gets 10 new S-1 synth, T-8 drum, and T-8 bass patterns.
"""

import json
import os
import random

random.seed(42)  # reproducible output

STEPS = 16
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "data")

# Drum voice MIDI notes
BD, RS, SD, CH, OH, CB, CY, CP, RD = 36, 37, 38, 42, 46, 47, 49, 50, 51

GENRES = [
    "techno", "acid-techno", "trance", "dub-techno", "idm", "edm",
    "drum-and-bass", "house", "breakbeat", "jungle", "garage",
    "ambient", "glitch", "electro", "downtempo",
]

# ─── Helpers ─────────────────────────────────────────────

def N(semi, vel=1.0, slide=False):
    """Create a melodic note step."""
    return {"semi": semi, "vel": round(vel, 2), "slide": bool(slide)}

def H(note, vel=100):
    """Create a drum hit."""
    return {"note": note, "vel": vel}

R = None  # rest


# ─── S-1 SYNTH PATTERNS ──────────────────────────────────

def s1_patterns_for(genre):
    """Return list of 10 new S-1 patterns for the given genre."""
    g = SYNTH_PATTERNS.get(genre)
    if g is None:
        raise ValueError(f"Unknown genre: {genre}")
    return g


SYNTH_PATTERNS = {
    # ── TECHNO ──
    "techno": [
        # 1. Siren Cycle — rising minor scale loop
        [N(0), N(3), N(5), N(7), N(10), N(12), N(10), N(7), N(5), N(3), N(0), R, N(0), R, N(0), R],
        # 2. Piston — accented root with ghost notes
        [N(0,1.3), N(0,0.6), N(0,1.0), N(0,0.6), N(0,1.3), N(0,0.6), N(0,1.0), N(0,0.6), N(0,1.3), N(0,0.6), N(0,1.0), N(0,0.6), N(0,1.3), N(0,0.6), N(0,1.0), N(0,0.6)],
        # 3. Flatline — sparse root stabs on downbeats only
        [N(0,1.2), R, R, R, N(0,1.0), R, R, R, N(0,1.2), R, R, R, N(0,1.0), R, R, R],
        # 4. Minor Triad Lock — cycling root-b3-5
        [N(0), N(3), N(7), R, N(0), N(3), N(7), R, N(0), N(3), N(7), R, N(0), N(3), N(7), R],
        # 5. Sub Drop — low octave pulse with occasional rise
        [N(-12,1.2), R, N(-12), R, N(-12,1.2), R, N(0), R, N(-12,1.2), R, N(-12), R, N(-12,1.2), R, N(0), R],
        # 6. Ascender — chromatic rise across bar
        [N(0), R, N(1), R, N(2), R, N(3), R, N(4), R, N(5), R, N(6), R, N(7), R],
        # 7. Call-Answer — two-beat phrase repeated with variation
        [N(0), N(3), N(5), R, N(7), N(5), N(3), R, N(0), N(3), N(7), R, N(5), N(3), N(0), R],
        # 8. Velocity Pump — same pitch, dynamic contrast
        [N(0,1.3), N(0,0.5), N(0,1.0), N(0,0.5), N(0,1.3), N(0,0.5), N(0,1.0), N(0,0.5), N(0,1.3), R, N(0,1.0), R, N(0,1.3), R, N(0,0.5), R],
        # 9. Warehouse Stab — sparse syncopated minor
        [N(0,1.2), R, R, N(3), R, R, N(7), R, N(0,1.2), R, R, N(5), R, R, N(3), R],
        # 10. Hypnotic Fifth — root and fifth alternating with slides
        [N(0,1.0,True), R, N(7,1.0,True), R, N(0,1.0,True), R, N(7,1.0,True), R, N(0,1.0,True), R, N(7,1.0,True), R, N(0,1.0,True), R, N(7,1.0,True), N(12)],
    ],

    # ── ACID-TECHNO ──
    "acid-techno": [
        # 1. Squelch Staircase — ascending with slides and accents
        [N(0,1.3), N(2,1.0,True), N(3,1.0,True), N(5,1.3,True), N(7,1.0), N(10,1.0,True), N(12,1.3), R, N(0,1.3), N(3,1.0,True), N(5,1.0,True), N(7,1.3,True), N(10,1.0), N(12,1.0,True), N(15,1.3), R],
        # 2. Rubber Band — octave bounce with chromatic passing tones
        [N(0,1.3), N(12,1.0,True), N(11,1.0,True), N(0,1.3), R, N(12,1.0,True), N(10,1.0,True), N(0,1.3), R, N(12,1.0,True), N(11,1.0,True), N(0,1.3), R, N(12,1.0), N(10,1.0,True), N(0,1.3)],
        # 3. Acid Rain — dense 16th with heavy slides
        [N(0,1.0,True), N(3,1.0,True), N(0,1.3), N(7,1.0,True), N(5,1.0,True), N(3,1.3), N(0,1.0,True), N(-2,1.0,True), N(0,1.3), N(5,1.0,True), N(3,1.0,True), N(7,1.3), N(12,1.0,True), N(10,1.0,True), N(7,1.3), N(5,1.0,True)],
        # 4. Screamer — high register acid shrieks
        [N(12,1.3), R, N(15,1.0,True), R, N(12,1.3), N(14,1.0,True), N(12,1.0,True), R, N(12,1.3), R, N(17,1.0,True), R, N(15,1.3), N(14,1.0,True), N(12,1.0,True), R],
        # 5. Sub Acid — deep register with occasional octave stab
        [N(-12,1.3), N(-10,1.0,True), N(-12,1.0), R, N(-12,1.3), N(-7,1.0,True), N(-12,1.0), R, N(0,1.3), R, N(-12,1.0), R, N(-12,1.3), N(-10,1.0,True), N(-5,1.0,True), R],
        # 6. Wobble Lock — alternating accent/slide on 2 notes
        [N(0,1.3,True), N(3,1.0), N(0,1.3,True), N(3,1.0), N(0,1.3,True), N(3,1.0), N(0,1.3,True), N(3,1.0), N(0,1.3,True), N(5,1.0), N(0,1.3,True), N(5,1.0), N(0,1.3,True), N(7,1.0), N(0,1.3,True), N(7,1.0)],
        # 7. Chromatic Spiral Down — descending chromatic with slides
        [N(12,1.3), N(11,1.0,True), N(10,1.0,True), N(9,1.0,True), N(8,1.3), N(7,1.0,True), N(6,1.0,True), N(5,1.0,True), N(4,1.3), N(3,1.0,True), N(2,1.0,True), N(1,1.0,True), N(0,1.3), R, N(12,1.0), R],
        # 8. TAoW Classic — accent+slide octave drop (the iconic 303 sound)
        [N(12,1.3,True), N(0,1.0), R, R, N(12,1.3,True), N(0,1.0), R, N(10,1.0,True), N(12,1.3,True), N(0,1.0), R, R, N(12,1.3,True), N(0,1.0), R, N(10,1.0,True)],
        # 9. Phuture Bounce — inspired by Phuture's minimal acid
        [N(0,1.3), N(0,1.0), N(3,1.0,True), N(3,1.0), N(0,1.3), N(0,1.0), N(5,1.0,True), N(5,1.0), N(0,1.3), N(0,1.0), N(3,1.0,True), N(7,1.3,True), N(5,1.0), N(3,1.0,True), N(0,1.3), R],
        # 10. Resonance Peak — accented root bursts with filter sweep feel
        [N(0,1.3), N(0,1.3), R, R, N(0,1.3), N(0,1.3), R, N(12,1.0,True), N(0,1.3), N(0,1.3), R, R, N(0,1.3), N(12,1.0,True), N(10,1.0,True), N(0,1.3)],
    ],

    # ── TRANCE ──
    "trance": [
        # 1. Uplift Arp — ascending minor arpeggio with accents on peaks
        [N(0,0.8), N(3), N(7,1.2), N(12,1.3), N(0,0.8), N(3), N(7,1.2), N(12,1.3), N(0,0.8), N(3), N(7,1.2), N(12,1.3), N(15,1.3), N(12,1.2), N(7), N(3,0.8)],
        # 2. Gate Pulse — gated pad rhythm with dynamics
        [N(0,1.3), R, N(0,0.8), R, N(7,1.3), R, N(7,0.8), R, N(0,1.3), R, N(0,0.8), R, N(12,1.3), R, N(12,0.8), R],
        # 3. Anthem Lead — bold melodic phrase with accented peaks
        [N(0,1.3), R, N(3,0.8), N(5), N(7,1.3), R, N(5,0.8), N(3), N(0,1.3), R, N(7,0.8), N(10,1.2), N(12,1.3), R, N(10,0.8), N(7)],
        # 4. Rolling Offbeat — offbeat synth stabs, accented downbeats
        [R, N(0,1.3), R, N(0,0.8), R, N(7,1.3), R, N(7,0.8), R, N(0,1.3), R, N(0,0.8), R, N(12,1.3), R, N(12,0.8)],
        # 5. Ethereal Sparse — wide intervals, dynamic contrast
        [N(0,1.3), R, R, R, N(12,0.8), R, R, R, N(7,1.2), R, R, R, N(0,0.8), R, R, R],
        # 6. Descending Cascade — falling with velocity fade
        [N(12,1.3), N(10,1.2), N(7,1.0), N(5,0.8), N(3,0.8), N(0,1.3), R, R, N(12,1.3), N(10,1.2), N(7,1.0), N(5,0.8), N(3,0.8), N(0,1.3), N(-5,0.8), R],
        # 7. Trance Stab — rhythmic chord stab with ghost notes
        [N(0,1.3), R, R, N(0,0.5), R, R, N(0,1.3), R, N(7,1.3), R, R, N(7,0.5), R, R, N(7,1.3), R],
        # 8. Supersaw Ride — dense 16th with accent pattern
        [N(0,1.3), N(0,0.8), N(3,1.2), N(3,0.8), N(7,1.3), N(7,0.8), N(3,1.2), N(3,0.8), N(0,1.3), N(0,0.8), N(5,1.2), N(5,0.8), N(7,1.3), N(7,0.8), N(12,1.3), N(12,1.3)],
        # 9. Pluck Sequence — transposing motif with peak accents
        [N(0,0.8), N(3), N(7,1.3), N(3,0.8), N(5), N(8,1.2), N(12,1.3), N(8,0.8), N(7), N(10,1.2), N(14,1.3), N(10,0.8), N(5), N(8,1.2), N(12,1.3), N(8,0.8)],
        # 10. Breakdown Melody — emotional with dynamic swells
        [N(0,0.8,True), R, N(3,1.0,True), R, N(7,1.2), R, R, N(12,1.3,True), R, N(10,1.0,True), R, N(7,0.8), R, R, N(5,0.8,True), R],
    ],

    # ── DUB-TECHNO ──
    "dub-techno": [
        # 1. Deep Chord — sparse sustained chord feel (differs from Deep Pulse: has 7th)
        [N(0), R, R, R, R, R, R, R, N(10,0.7), R, R, R, R, R, R, R],
        # 2. Echo Stab — stab with delay-like repetition fading
        [N(0,1.2), R, N(0,0.8), R, N(0,0.5), R, R, R, N(7,1.2), R, N(7,0.8), R, N(7,0.5), R, R, R],
        # 3. Underwater Drift — slow movement, minor 7th color
        [N(0), R, R, R, R, R, N(10), R, R, R, R, R, N(7), R, R, R],
        # 4. Foghorn — deep root drone with rare movement
        [N(-12,1.0,True), R, R, R, R, R, R, R, R, R, R, R, R, R, N(-5,0.8,True), R],
        # 5. Haze — two notes drifting
        [N(0,0.9), R, R, N(7,0.7), R, R, R, R, N(0,0.9), R, R, R, N(10,0.7), R, R, R],
        # 6. Chain Delay — rhythmic echo pattern
        [N(0,1.2), R, R, N(0,0.9), R, R, N(0,0.6), R, N(7,1.2), R, R, N(7,0.9), R, R, N(7,0.6), R],
        # 7. Submerged — ultra-deep, minimal
        [N(-12), R, R, R, R, R, R, R, R, R, R, R, R, R, R, R],
        # 8. Berlin Night — root + minor third, spacious
        [N(0,1.0), R, R, R, R, R, R, R, N(3,0.8), R, R, R, R, R, R, R],
        # 9. Depth Charge — sporadic deep hits
        [N(0,1.2), R, R, R, R, R, R, R, R, R, N(-12,1.0), R, R, R, R, R],
        # 10. Reef — gentle movement with slides
        [N(0,0.9,True), R, R, R, N(3,0.8,True), R, R, R, N(7,0.9,True), R, R, R, N(3,0.8,True), R, R, R],
    ],

    # ── IDM ──
    "idm": [
        # 1. Fractal — irregular intervals, shifting accents
        [N(0,1.2), R, N(7,0.8), N(-5,1.0), R, R, N(11,1.3), R, N(0,0.6), R, R, N(6,1.0), R, N(-3,0.8), R, R],
        # 2. Clockwork — precise mechanical pattern with odd intervals
        [N(0), N(6), R, N(11), N(0), R, N(6), N(11), R, N(0), N(6), R, N(11), R, N(0), R],
        # 3. Warp Glide — sliding between distant notes
        [N(0,1.0,True), R, N(11,1.0,True), R, N(-7,1.0,True), R, N(14,1.0,True), R, N(-3,1.0,True), R, N(9,1.0,True), R, N(-5,1.0,True), R, N(12,1.0,True), R],
        # 4. Scatter — unpredictable density
        [N(0,1.3), N(5,0.6), R, R, R, N(-7,1.0), R, N(12,0.5), R, R, N(3,1.3), R, R, R, N(-2,0.7), R],
        # 5. Microloop — tiny motif repeating
        [N(0), N(4), N(7), N(0), N(4), N(7), N(0), N(4), N(7), N(0), N(4), N(7), N(0), N(4), N(7), R],
        # 6. Detune — chromatic cluster
        [N(0), N(1), N(0), N(-1), N(0), N(2), N(0), N(-2), N(0), N(1), N(-1), N(2), N(-2), N(3), N(-3), N(0)],
        # 7. Phase Drift — two rhythmic layers implied
        [N(0,1.2), R, R, N(7,0.8), R, N(0,1.2), R, R, N(5,0.8), R, N(0,1.2), R, N(7,0.8), R, R, N(3,0.8)],
        # 8. Granular Burst — dense cluster then silence
        [N(0,1.3), N(2,1.0), N(4,0.8), N(6,0.6), R, R, R, R, R, R, R, R, N(12,1.3), N(10,1.0), N(8,0.8), N(6,0.6)],
        # 9. Algorithm — mathematically spaced intervals
        [N(0), R, N(5), R, R, N(11), R, N(4), R, R, N(9), R, N(2), R, R, N(7)],
        # 10. Organic Drift — slow evolving phrase
        [N(0,0.9,True), R, R, R, N(7,0.7,True), R, R, N(-5,0.9,True), R, R, R, N(3,0.7,True), R, R, N(10,0.9,True), R],
    ],

    # ── EDM ──
    "edm": [
        # 1. Festival Anthem — bold arpeggio
        [N(0,1.3), R, N(7,1.2), R, N(12,1.3), R, N(7,1.2), R, N(0,1.3), R, N(5,1.2), R, N(12,1.3), R, N(5,1.2), R],
        # 2. Drop Hammer — heavy root pump
        [N(0,1.3), N(0,1.0), N(0,1.3), N(0,1.0), N(0,1.3), N(0,1.0), N(0,1.3), N(0,1.0), N(0,1.3), N(0,1.0), N(0,1.3), N(0,1.0), N(0,1.3), N(0,1.0), N(0,1.3), N(0,1.0)],
        # 3. Build Riser — ascending scale momentum
        [N(0), R, N(0), N(3), R, N(3), N(5), R, N(5), N(7), R, N(7), N(12), R, N(12), N(12,1.3)],
        # 4. Pluck Lead — melodic pluck sequence
        [N(0), N(3), N(7), R, N(5), N(8), N(12), R, N(7), N(10), N(14), R, N(12), N(7), N(3), R],
        # 5. Big Room Stab — sparse power stabs
        [N(0,1.3), R, R, R, N(0,1.3), R, R, R, N(7,1.3), R, R, R, N(12,1.3), R, R, R],
        # 6. Sidechain Pulse — pumping rhythm
        [N(0,1.3), R, N(0,0.7), R, N(0,1.3), R, N(0,0.7), R, N(7,1.3), R, N(7,0.7), R, N(12,1.3), R, N(12,0.7), R],
        # 7. Tropical Arp — major-feel bounce
        [N(0), N(4), N(7), N(12), N(7), N(4), N(0), R, N(5), N(9), N(12), N(16), N(12), N(9), N(5), R],
        # 8. Electro House Riff — driving repeated riff
        [N(0), N(0), R, N(3), N(5), R, N(7), N(5), N(0), N(0), R, N(3), N(5), R, N(7), N(12)],
        # 9. Wobble Bass Lead — alternating octave wobble
        [N(0,1.3), N(12,1.0), N(0,1.3), N(12,1.0), N(0,1.3), N(12,1.0), N(0,1.3), N(12,1.0), N(5,1.3), N(17,1.0), N(5,1.3), N(17,1.0), N(7,1.3), N(19,1.0), N(7,1.3), N(19,1.0)],
        # 10. Mainstage — climactic big melody
        [N(0), R, N(3), N(7), N(12,1.3), R, N(10), N(7), N(5), R, N(3), N(7), N(12,1.3), R, N(15,1.3), R],
    ],

    # ── DRUM-AND-BASS ──
    "drum-and-bass": [
        # 1. Neuro Riff — aggressive bass movement
        [N(0,1.3), R, N(0), N(-2,1.0,True), R, N(0,1.3), R, N(5,1.0,True), N(0,1.3), R, N(0), N(3,1.0,True), R, N(0,1.3), R, N(-5,1.0,True)],
        # 2. Liquid Melody — smooth flowing line
        [N(0), N(3), N(7), R, N(5), N(3), N(0), R, N(-5), N(0), N(3), R, N(7), N(5), N(3), R],
        # 3. Sub Roller — deep rolling sub bass
        [N(-12,1.3), R, N(-12), R, N(-12,1.3), R, N(-12), R, N(-12,1.3), R, N(-12), R, N(-12,1.3), R, N(-12), N(-12,0.8)],
        # 4. Jump Up — bouncy, energetic
        [N(0,1.3), R, R, N(0), R, N(12,1.3), R, R, N(0,1.3), R, R, N(5), R, N(12,1.3), R, R],
        # 5. Reese Growl — dark sliding bass
        [N(0,1.2,True), N(-2,1.0,True), N(0,1.2,True), N(3,1.0,True), N(0,1.2), R, N(0,1.2,True), N(5,1.0,True), N(0,1.2,True), N(-2,1.0,True), N(0,1.2,True), N(7,1.0,True), N(5,1.0), R, N(0,1.2,True), N(3,1.0,True)],
        # 6. Steppy — choppy staccato hits
        [N(0,1.2), R, N(0,0.8), R, N(5,1.2), R, N(5,0.8), R, N(7,1.2), R, N(7,0.8), R, N(0,1.2), R, N(-5,0.8), R],
        # 7. Halftime — slower feel, heavy
        [N(0,1.3), R, R, R, R, R, R, N(-5,1.0,True), N(0,1.3), R, R, R, R, R, R, N(3,1.0,True)],
        # 8. Amen Bassline — following the break rhythm
        [N(0,1.3), R, N(0), R, N(-5,1.0), N(0,1.3), R, N(0), R, N(0,1.3), R, R, N(-5,1.0), N(0,1.3), R, N(0)],
        # 9. Tearout — aggressive dense
        [N(0,1.3), N(0,1.0), N(3,1.3), N(0,1.0), N(5,1.3), N(0,1.0), N(3,1.3), N(0,1.0), N(7,1.3), N(5,1.0), N(3,1.3), N(0,1.0), N(5,1.3), N(3,1.0), N(0,1.3), N(-5,1.0)],
        # 10. Dancefloor — classic DnB melodic bass
        [N(0), R, N(3), N(5), R, N(7), R, N(5), N(0), R, N(3), N(7), R, N(10), R, N(7)],
    ],

    # ── HOUSE ──
    "house": [
        # 1. Disco Chop — funky chopped rhythm
        [N(0), R, N(0), R, N(3), R, N(0), R, N(5), R, N(3), R, N(0), R, N(7), R],
        # 2. Piano Stab — classic house piano hit
        [N(0,1.2), R, R, N(0), R, R, N(0,1.2), R, N(7,1.2), R, R, N(7), R, R, N(7,1.2), R],
        # 3. Organ Groove — soulful organ riff
        [N(0), N(3), R, N(5), N(7), R, N(5), R, N(0), N(3), R, N(5), N(7), R, N(10), R],
        # 4. Deep Minimal — ultra-sparse deep house
        [N(0), R, R, R, R, R, R, R, N(7), R, R, R, R, R, R, R],
        # 5. Groove Bounce — swinging offbeat
        [R, N(0,1.2), R, N(0), R, N(3,1.2), R, N(3), R, N(5,1.2), R, N(5), R, N(7,1.2), R, N(7)],
        # 6. Jacking — fast rhythmic pulse
        [N(0,1.2), N(0,0.8), N(0,1.2), N(0,0.8), N(3,1.2), N(3,0.8), N(3,1.2), N(3,0.8), N(5,1.2), N(5,0.8), N(5,1.2), N(5,0.8), N(7,1.2), N(7,0.8), N(7,1.2), N(7,0.8)],
        # 7. Filtered — sparse with accent variation
        [N(0,1.3), R, R, R, N(0,0.7), R, R, R, N(7,1.3), R, R, R, N(7,0.7), R, R, R],
        # 8. Chicago Classic — root and fifth bounce
        [N(0), R, N(7), R, N(0), R, N(7), R, N(0), R, N(7), R, N(5), R, N(7), R],
        # 9. Vocal Chop Rhythm — rhythmic pattern for vocal/synth
        [N(0,1.2), R, N(0,0.8), N(3), R, N(5,1.2), R, N(3,0.8), N(0,1.2), R, N(0,0.8), N(7), R, N(5,1.2), R, N(3,0.8)],
        # 10. Sunset Drive — melodic deep house
        [N(0), N(3), N(7), N(10), N(7), N(3), R, R, N(0), N(5), N(7), N(12), N(7), N(5), R, R],
    ],

    # ── BREAKBEAT ──
    "breakbeat": [
        # 1. Funky Breaks — syncopated funk groove
        [N(0,1.2), R, N(0,0.8), N(3), R, N(5,1.2), R, N(3,0.8), R, N(0,1.2), N(3,0.8), R, N(5), R, N(0,1.2), R],
        # 2. Big Beat Riff — Chemical Brothers style
        [N(0,1.3), N(0,1.0), R, N(3), N(5,1.3), R, N(3), R, N(0,1.3), N(0,1.0), R, N(7), N(5,1.3), R, N(3), R],
        # 3. Prodigy Stab — aggressive stab pattern
        [N(0,1.3), R, R, N(0,1.3), R, R, N(0,1.3), R, N(5,1.3), R, R, N(5,1.3), R, R, N(7,1.3), R],
        # 4. Dusty Groove — laid-back breakbeat
        [N(0,1.0), R, R, N(3,0.8), R, N(0), R, R, N(5,1.0), R, R, N(3,0.8), R, N(7), R, R],
        # 5. Acid Break — breakbeat meets acid
        [N(0,1.3), N(3,1.0,True), R, N(0,1.3), N(5,1.0,True), R, N(7,1.0,True), R, N(0,1.3), N(3,1.0,True), R, N(5), N(7,1.0,True), R, N(0,1.3), R],
        # 6. Nu Skool — modern breakbeat
        [N(0,1.2), R, N(0,0.7), R, R, N(5,1.2), R, N(3,0.7), N(0,1.2), R, N(7,0.7), R, R, N(5,1.2), R, N(0,0.7)],
        # 7. B-Boy — hip-hop influenced
        [N(0,1.3), R, R, N(0), R, N(-5,1.2), R, R, N(0,1.3), R, R, N(3), R, N(-5,1.2), R, R],
        # 8. Filtered Break — dynamic filter sweep feel
        [N(0,0.6), N(0,0.7), N(0,0.8), N(0,0.9), N(0,1.0), N(0,1.1), N(0,1.2), N(0,1.3), N(0,1.3), N(0,1.2), N(0,1.1), N(0,1.0), N(0,0.9), N(0,0.8), N(0,0.7), N(0,0.6)],
        # 9. Scratch Hook — rhythmic scratch-like pattern
        [N(0,1.3), N(0,0.5), N(0,1.3), R, R, N(5,1.3), N(5,0.5), N(5,1.3), R, R, N(7,1.3), N(7,0.5), N(7,1.3), R, R, R],
        # 10. Warehouse Rave — old-school breakbeat rave
        [N(0,1.3), R, N(3), N(5), R, N(7,1.3), R, N(5), N(0,1.3), R, N(3), N(7), R, N(12,1.3), R, N(7)],
    ],

    # ── JUNGLE ──
    "jungle": [
        # 1. Ragga Bass — reggae-influenced bass
        [N(0,1.3), R, R, N(0), R, N(-5,1.0,True), R, R, N(0,1.3), R, R, N(0), R, N(-7,1.0,True), R, R],
        # 2. Dark Roller — menacing rolling line
        [N(-12,1.3,True), N(-10,1.0,True), N(-12,1.3), R, N(-12,1.3,True), N(-7,1.0,True), N(-12,1.3), R, N(-12,1.3,True), N(-5,1.0,True), N(-12,1.3), R, N(-12,1.3,True), N(-10,1.0,True), N(-12,1.3), R],
        # 3. Stepper — steady stepping bass
        [N(0,1.2), R, N(0), R, N(0,1.2), R, N(0), R, N(-5,1.2), R, N(-5), R, N(0,1.2), R, N(0), R],
        # 4. Dread Bass — deep dub influence
        [N(-12,1.3), R, R, R, R, R, R, R, N(-7,1.0,True), R, R, R, R, R, N(-12,1.0,True), R],
        # 5. Choppy Stabs — rapid fire jungle stabs
        [N(0,1.3), R, N(0,0.8), N(0,1.3), R, N(0,0.8), R, N(5,1.3), N(0,1.3), R, N(0,0.8), N(0,1.3), R, N(7,1.3), R, N(5,0.8)],
        # 6. Amen Lead — melodic line riding the break
        [N(0), N(3), N(7), R, N(5), R, N(3), N(0), R, N(3), N(5), N(7), R, N(10), N(7), R],
        # 7. Sub Pressure — ultra-deep sub with accents
        [N(-12,1.3), R, R, R, R, R, N(-12,1.0), R, N(-12,1.3), R, R, R, R, R, N(-12,1.0), R],
        # 8. Rewind — building urgency
        [N(0,1.0), N(0,1.0), N(0,1.1), N(0,1.1), N(0,1.2), N(0,1.2), N(0,1.3), N(0,1.3), N(5,1.0), N(5,1.0), N(5,1.1), N(5,1.1), N(5,1.2), N(5,1.2), N(5,1.3), N(5,1.3)],
        # 9. Roots — rootsy reggae bass pattern
        [N(0,1.2), R, R, R, R, R, N(0,0.8), R, R, R, N(-5,1.2), R, R, R, N(0,0.8), R],
        # 10. Rinse Out — fast aggressive jungle bass
        [N(0,1.3), N(3,1.0,True), N(0,1.3), R, N(5,1.0,True), N(0,1.3), R, N(7,1.0,True), N(0,1.3), N(3,1.0,True), N(0,1.3), R, N(-5,1.0,True), N(0,1.3), R, N(3,1.0,True)],
    ],

    # ── GARAGE ──
    "garage": [
        # 1. 2-Step Melody — bouncy skippy lead
        [N(0,1.2), R, N(3), R, R, N(7,1.2), R, N(5), R, N(0,1.2), R, N(3), R, R, N(10,1.2), R],
        # 2. R&B Chord — smooth chord progression feel
        [N(0), N(3), N(7), R, R, R, N(5), N(8), N(12), R, R, R, N(3), N(7), N(10), R],
        # 3. Bassline Garage — wobbly bass lead
        [N(0,1.3), R, N(0,0.8), R, N(3,1.3), R, R, N(5,0.8), N(7,1.3), R, N(5,0.8), R, N(3,1.3), R, R, N(0,0.8)],
        # 4. Vocal Chop — choppy vocal-style rhythm
        [N(0,1.2), N(0,0.6), R, N(3,1.2), R, N(3,0.6), R, N(5,1.2), N(5,0.6), R, N(7,1.2), R, N(7,0.6), R, N(10,1.2), R],
        # 5. Skippy — ultra-bouncy garage groove
        [N(0,1.2), R, R, N(0), R, N(5,1.2), R, R, N(5), R, N(7,1.2), R, R, N(7), R, N(10,1.2)],
        # 6. Deep Garage — deeper, more minimal
        [N(0,1.0), R, R, R, R, R, N(7,0.8), R, R, R, N(0,1.0), R, R, R, R, R],
        # 7. Speed Garage — faster, bassier
        [N(0,1.3), N(0,1.0), R, N(3,1.3), N(0,1.0), R, N(5,1.3), N(0,1.0), R, N(7,1.3), N(5,1.0), R, N(3,1.3), N(0,1.0), R, R],
        # 8. Garage Diva — soulful melodic line
        [N(0), R, N(3), N(5), N(7), R, N(10), R, N(7), R, N(5), N(3), N(0), R, R, R],
        # 9. Shuffled — heavy shuffle feel
        [N(0,1.2), R, N(0,0.7), N(3,1.2), R, N(3,0.7), N(5,1.2), R, N(5,0.7), N(7,1.2), R, N(7,0.7), N(10,1.2), R, N(10,0.7), N(12,1.2)],
        # 10. Night Drive — moody late-night garage
        [N(0,0.9), R, R, N(3,0.7), R, R, R, N(7,0.9), R, R, N(10,0.7), R, R, R, N(0,0.9), R],
    ],

    # ── AMBIENT ──
    "ambient": [
        # 1. Glass Bells — high register chime pattern, irregular placement
        [R, R, N(19,0.6), R, R, R, R, N(24,0.5), R, R, R, N(16,0.6), R, R, R, R],
        # 2. Tidal Breath — slow rise and fall with slides, 4 notes
        [N(0,0.7,True), R, R, R, N(5,0.6,True), R, R, R, N(7,0.7,True), R, R, R, N(5,0.6,True), R, R, R],
        # 3. Morse — rhythmic cluster then void (3 notes grouped, rest empty)
        [N(0,0.8), N(7,0.6), N(12,0.5), R, R, R, R, R, R, R, R, R, R, R, R, R],
        # 4. Bipolar — extreme register contrast, sub vs shimmer
        [N(-12,0.8), R, R, R, R, R, R, R, N(24,0.5), R, R, R, R, R, R, R],
        # 5. Descending Mist — slow chromatic descent with velocity fade
        [N(7,0.8), R, R, R, N(6,0.7), R, R, R, N(5,0.6), R, R, R, N(4,0.5), R, R, R],
        # 6. Constellation — 5 notes scattered asymmetrically across bar
        [R, N(12,0.6), R, R, R, N(0,0.7), R, R, R, R, N(7,0.5), R, N(19,0.5), R, R, R],
        # 7. Pendulum — two notes swinging with slides, gentle
        [N(0,0.7,True), R, R, R, R, R, R, R, N(12,0.6,True), R, R, R, R, R, R, R],
        # 8. Rain on Glass — irregular drips at varied velocities
        [R, N(14,0.5), R, R, R, R, N(19,0.6), R, R, N(12,0.5), R, R, R, R, N(17,0.6), R],
        # 9. Deep Call — sub drone answered by high echo
        [N(-12,0.9), R, R, R, R, R, R, R, R, R, N(19,0.5), R, N(24,0.5), R, R, R],
        # 10. Frozen Lake — cluster of close intervals, icy texture
        [N(0,0.6), R, N(1,0.5), R, R, R, R, R, N(0,0.6), R, N(-1,0.5), R, R, R, R, R],
    ],

    # ── GLITCH ──
    "glitch": [
        # 1. Buffer Overflow — stuttering repeats
        [N(0,1.3), N(0,1.3), N(0,0.5), R, R, N(7,1.3), N(7,0.5), R, N(0,1.3), N(0,0.5), R, R, N(-3,1.3), N(-3,0.5), R, R],
        # 2. Bit Crush — extreme velocity contrasts
        [N(0,1.3), N(0,0.5), N(5,1.3), N(5,0.5), N(11,1.3), N(11,0.5), N(6,1.3), N(6,0.5), N(1,1.3), N(1,0.5), N(8,1.3), N(8,0.5), N(3,1.3), N(3,0.5), N(10,1.3), N(10,0.5)],
        # 3. Skip — random-feeling gaps
        [N(0,1.0), R, R, N(4,1.2), R, R, R, R, N(-3,1.0), R, N(8,1.2), R, R, R, R, N(2,1.0)],
        # 4. Micro Cut — tiny fragments
        [N(0,1.3), N(0,0.5), R, R, R, R, R, R, N(7,1.3), N(7,0.5), R, R, R, R, R, R],
        # 5. Granular — dense cloud of notes
        [N(0,0.6), N(1,0.7), N(-1,0.8), N(2,0.9), N(-2,1.0), N(3,0.9), N(-3,0.8), N(4,0.7), N(-4,0.6), N(5,0.7), N(-5,0.8), N(6,0.9), N(-6,1.0), N(7,0.9), N(-7,0.8), N(0,0.7)],
        # 6. Freeze — single note repeated with glitchy gaps
        [N(0,1.0), N(0,1.0), N(0,1.0), R, N(0,1.0), R, R, R, N(0,1.0), N(0,1.0), R, R, R, N(0,1.0), R, R],
        # 7. Digital Debris — scattered fragments
        [R, N(11,1.3), R, R, N(-7,0.6), R, R, N(4,1.0), R, R, R, N(-2,1.3), R, R, N(9,0.6), R],
        # 8. Stretch — notes getting farther apart
        [N(0,1.2), N(1,1.0), R, N(3,1.2), R, R, N(7,1.2), R, R, R, N(12,1.2), R, R, R, R, R],
        # 9. Tape Stop — decelerating feel via velocity
        [N(0,1.3), N(0,1.2), N(0,1.1), N(0,1.0), N(0,0.9), N(0,0.8), N(0,0.7), N(0,0.6), N(0,0.5), R, R, R, R, R, R, R],
        # 10. Reboot — silence then sudden burst
        [R, R, R, R, R, R, R, R, R, R, N(0,1.3), N(5,1.3), N(7,1.3), N(12,1.3), N(0,1.3), N(5,1.3)],
    ],

    # ── ELECTRO ──
    "electro": [
        # 1. Robot Walk — mechanical stepping, paired notes
        [N(0,1.2), R, N(0,0.8), R, N(3,1.2), R, N(3,0.8), R, N(5,1.2), R, N(5,0.8), R, N(7,1.2), R, N(7,0.8), R],
        # 2. Vocoder Riff — synth-voice, dense alternating
        [N(0,1.3), N(3,0.8), N(0,1.3), N(5,0.8), N(0,1.3), N(7,0.8), N(0,1.3), N(5,0.8), N(0,1.3), N(3,0.8), N(0,1.3), N(7,0.8), N(0,1.3), N(5,0.8), N(0,1.3), N(3,0.8)],
        # 3. Trans-Europe — Kraftwerk, doubled notes with gaps
        [N(0,1.2), N(0,0.8), R, N(3,1.2), N(3,0.8), R, N(5,1.2), N(5,0.8), R, N(7,1.2), N(7,0.8), R, N(5,1.2), N(5,0.8), R, R],
        # 4. Funk Machine — syncopated electro-funk
        [N(0,1.3), R, N(0,0.8), N(3,1.0), R, N(5,1.3), R, N(3,0.8), N(0,1.3), R, N(0,0.8), N(7,1.0), R, N(5,1.3), R, N(3,0.8)],
        # 5. 808 Sub — sparse deep 808 hits
        [N(-12,1.3), R, R, R, N(-12,1.0), R, R, R, N(-12,1.3), R, R, N(-7,1.0), R, R, N(-12,1.3), R],
        # 6. Neon — bright arp with rests between groups
        [N(0,0.8), N(7,1.0), N(12,1.3), R, N(0,0.8), N(5,1.0), N(12,1.3), R, N(0,0.8), N(3,1.0), N(12,1.3), R, N(0,0.8), N(7,1.0), N(12,1.3), R],
        # 7. Breakin' — b-boy groove, sparse syncopated
        [N(0,1.3), R, R, N(0,0.8), R, N(0,1.3), R, R, N(5,1.3), R, R, N(5,0.8), R, N(0,1.3), R, R],
        # 8. Cyber — chromatic arc with breath
        [N(0,1.2), N(4,1.0), N(7,1.2), N(11,1.3), R, N(12,1.3), N(11,1.2), N(7,1.0), R, N(0,1.2), N(-5,1.2), N(-8,1.3), R, N(-12,1.3), N(-8,1.2), N(-1,0.8)],
        # 9. Power Grid — 16th root with gap every 4
        [N(0,1.3), N(0,0.5), N(0,1.3), R, N(0,1.3), N(0,0.5), N(0,1.3), R, N(0,1.3), N(0,0.5), N(0,1.3), R, N(0,1.3), N(0,0.5), N(0,1.3), R],
        # 10. Autobahn — motorik, accent on downbeats only
        [N(0,1.3), R, N(7,0.8), R, N(0,1.3), R, N(7,0.8), R, N(0,1.3), R, N(7,0.8), N(12,1.3), R, R, N(7,0.8), R],
    ],

    # ── DOWNTEMPO ──
    "downtempo": [
        # 1. Velvet — smooth jazzy melody
        [N(0), R, N(3), R, N(7), R, R, N(10), R, N(7), R, N(5), R, N(3), R, R],
        # 2. Vinyl Crackle — sparse nostalgic feel
        [N(0,0.9), R, R, R, R, R, R, R, N(5,0.7), R, R, R, R, R, R, R],
        # 3. Midnight — dark moody phrase
        [N(0,1.0), R, R, N(-5,0.8), R, R, N(3,1.0), R, R, N(0,0.8), R, R, N(-2,1.0), R, R, R],
        # 4. Lazy River — slow flowing melody
        [N(0,0.9,True), R, R, R, N(5,0.8,True), R, R, R, N(7,0.9,True), R, R, R, N(5,0.8,True), R, R, R],
        # 5. Dusty Keys — Rhodes-like chord rhythm
        [N(0,1.0), R, N(3), N(7), R, R, R, R, N(5,1.0), R, N(8), N(12), R, R, R, R],
        # 6. Trip — psychedelic sparse
        [R, R, N(0,0.8), R, R, R, R, N(10,0.7), R, R, N(7,0.8), R, R, R, R, N(3,0.7)],
        # 7. Lounge — smooth and sophisticated
        [N(0), N(4), N(7), R, R, N(5), N(9), N(12), R, R, N(3), N(7), N(10), R, R, R],
        # 8. Haze — dreamy slow movement
        [N(0,0.8,True), R, R, R, R, R, N(7,0.7,True), R, R, R, R, R, N(12,0.6,True), R, R, R],
        # 9. Boom Bap Soul — hip-hop influenced
        [N(0,1.2), R, R, N(0,0.8), R, N(-5,1.2), R, R, N(0,1.2), R, R, N(3,0.8), R, N(-5,1.2), R, R],
        # 10. Sunset — warm descending line
        [N(12,0.9), R, N(10,0.8), R, N(7,0.9), R, N(5,0.8), R, N(3,0.9), R, N(0,0.8), R, N(-2,0.9), R, N(0,0.8), R],
    ],
}


# ─── T-8 DRUM PATTERNS ───────────────────────────────────

def drum_patterns_for(genre):
    """Return list of 10 new T-8 drum patterns for the given genre."""
    return DRUM_PATTERNS[genre]


DRUM_PATTERNS = {
    # ── TECHNO ──
    "techno": [
        # 1. Berlin Minimal — kick + minimal hats
        [[H(BD,120)],[],[H(CH,80)],[],[H(BD,100),H(SD,100)],[],[H(CH,80)],[],[H(BD,120)],[],[H(CH,80)],[],[H(BD,100),H(SD,100)],[],[H(CH,80)],[]],
        # 2. Industrial Pound — heavy kick pattern
        [[H(BD,120)],[H(BD,80)],[H(CH,100)],[],[H(BD,120),H(CP,110)],[],[H(CH,100)],[H(BD,80)],[H(BD,120)],[H(BD,80)],[H(CH,100)],[],[H(BD,120),H(CP,110)],[],[H(CH,100)],[H(BD,80)]],
        # 3. Hat Dance — 16th hi-hat focus
        [[H(BD,120),H(CH,100)],[H(CH,60)],[H(CH,100)],[H(CH,60)],[H(BD,100),H(SD,110),H(CH,100)],[H(CH,60)],[H(CH,100)],[H(CH,60)],[H(BD,120),H(CH,100)],[H(CH,60)],[H(CH,100)],[H(CH,60)],[H(BD,100),H(SD,110),H(CH,100)],[H(CH,60)],[H(CH,100)],[H(OH,100)]],
        # 4. Ride Techno — ride cymbal driven
        [[H(BD,120),H(RD,100)],[H(RD,60)],[H(RD,100)],[H(RD,60)],[H(BD,100),H(CP,100),H(RD,100)],[H(RD,60)],[H(RD,100)],[H(RD,60)],[H(BD,120),H(RD,100)],[H(RD,60)],[H(RD,100)],[H(RD,60)],[H(BD,100),H(CP,100),H(RD,100)],[H(RD,60)],[H(RD,100)],[H(RD,60)]],
        # 5. Stripped — kick and clap only
        [[H(BD,120)],[],[],[],[H(BD,100),H(CP,110)],[],[],[],[H(BD,120)],[],[],[],[H(BD,100),H(CP,110)],[],[],[]],
        # 6. Syncopated Kick — off-grid kicks
        [[H(BD,120)],[],[H(BD,80)],[],[H(SD,110)],[],[],[H(BD,100)],[],[H(BD,80)],[],[],[H(SD,110)],[],[H(BD,100)],[]],
        # 7. Percussion Layer — cowbell + rimshot texture
        [[H(BD,120),H(CH,80)],[H(RS,70)],[H(CH,80)],[H(CB,60)],[H(BD,100),H(SD,110),H(CH,80)],[H(RS,70)],[H(CH,80)],[H(CB,60)],[H(BD,120),H(CH,80)],[H(RS,70)],[H(CH,80)],[H(CB,60)],[H(BD,100),H(SD,110),H(CH,80)],[H(RS,70)],[H(CH,80)],[H(CB,60)]],
        # 8. Half-Time Feel — slow heavy
        [[H(BD,120),H(CH,80)],[H(CH,60)],[H(CH,80)],[H(CH,60)],[H(CH,80)],[H(CH,60)],[H(CH,80)],[H(CH,60)],[H(BD,100),H(SD,120),H(CH,80)],[H(CH,60)],[H(CH,80)],[H(CH,60)],[H(CH,80)],[H(CH,60)],[H(CH,80)],[H(CH,60)]],
        # 9. Double Kick — kick on every 8th
        [[H(BD,120),H(CH,100)],[H(CH,60)],[H(BD,100),H(CH,100)],[H(CH,60)],[H(BD,100),H(SD,110),H(CH,100)],[H(CH,60)],[H(BD,80),H(CH,100)],[H(CH,60)],[H(BD,120),H(CH,100)],[H(CH,60)],[H(BD,100),H(CH,100)],[H(CH,60)],[H(BD,100),H(SD,110),H(CH,100)],[H(CH,60)],[H(BD,80),H(CH,100)],[H(CH,60)]],
        # 10. Warehouse Stomp — raw and driving
        [[H(BD,120),H(OH,100)],[],[H(BD,80)],[],[H(BD,100),H(CP,120)],[],[H(OH,100)],[],[H(BD,120)],[],[H(BD,80),H(OH,100)],[],[H(BD,100),H(CP,120)],[],[],[H(OH,80)]],
    ],

    # ── ACID-TECHNO ──
    "acid-techno": [
        # 1. 909 Acid — classic 909 with open hats on offbeats
        [[H(BD,120),H(CH,100)],[H(CH,80)],[H(OH,100)],[H(CH,80)],[H(BD,100),H(CP,110),H(CH,100)],[H(CH,80)],[H(OH,100)],[H(CH,80)],[H(BD,120),H(CH,100)],[H(CH,80)],[H(OH,100)],[H(CH,80)],[H(BD,100),H(CP,110),H(CH,100)],[H(CH,80)],[H(OH,100)],[H(CH,80)]],
        # 2. Hypnotic Acid — kick + OH only, no hats
        [[H(BD,120)],[H(OH,80)],[],[H(OH,80)],[H(BD,100),H(SD,100)],[H(OH,80)],[],[H(OH,80)],[H(BD,120)],[H(OH,80)],[],[H(OH,80)],[H(BD,100),H(SD,100)],[H(OH,80)],[],[H(OH,80)]],
        # 3. Acid Frenzy — dense 16th hats, OH on last step
        [[H(BD,120),H(CH,100)],[H(CH,100)],[H(CH,100)],[H(CH,100)],[H(BD,100),H(CP,120),H(CH,100)],[H(CH,100)],[H(CH,100)],[H(CH,100)],[H(BD,120),H(CH,100)],[H(CH,100)],[H(CH,100)],[H(CH,100)],[H(BD,100),H(CP,120),H(CH,100)],[H(CH,100)],[H(CH,100)],[H(OH,120)]],
        # 4. Clap Drive — double clap with ghost hats
        [[H(BD,120),H(CH,80)],[H(CH,50)],[H(CH,80)],[H(CH,50)],[H(BD,100),H(CP,120),H(CH,80)],[H(CH,50)],[H(CP,80),H(CH,80)],[H(CH,50)],[H(BD,120),H(CH,80)],[H(CH,50)],[H(CH,80)],[H(CH,50)],[H(BD,100),H(CP,120),H(CH,80)],[H(CH,50)],[H(CP,80),H(CH,80)],[H(CH,50)]],
        # 5. Kick Roll — rapid kick + sparse hat
        [[H(BD,120)],[H(BD,80)],[H(CH,100)],[H(BD,80)],[H(BD,120),H(CP,110)],[H(BD,80)],[H(CH,100)],[H(BD,80)],[H(BD,120)],[H(BD,80)],[H(CH,100)],[H(BD,80)],[H(BD,120),H(CP,110)],[H(BD,80)],[H(CH,100)],[H(BD,80)]],
        # 6. Tribal Acid — cowbell + rimshot, 4 voices
        [[H(BD,120),H(CH,80)],[H(RS,80)],[H(CH,80)],[H(CB,70)],[H(BD,100),H(CP,110)],[H(RS,80)],[H(CH,80)],[H(CB,70)],[H(BD,120),H(CH,80)],[H(RS,80)],[H(OH,80)],[H(CB,70)],[H(BD,100),H(CP,110)],[H(RS,80)],[H(CH,80)],[H(CB,70)]],
        # 7. Distorted — loud accents, snare on 2&4
        [[H(BD,120),H(CH,120)],[H(CH,60)],[H(CH,120)],[H(CH,60)],[H(BD,120),H(SD,120),H(CH,120)],[H(CH,60)],[H(CH,120)],[H(CH,60)],[H(BD,120),H(CH,120)],[H(CH,60)],[H(CH,120)],[H(CH,60)],[H(BD,120),H(SD,120),H(CH,120)],[H(CH,60)],[H(CH,120)],[H(CH,60)]],
        # 8. Stripped Acid — kick and clap only, maximum space
        [[H(BD,120)],[],[],[],[H(CP,110)],[],[],[],[H(BD,120)],[],[],[],[H(CP,110)],[],[],[H(BD,80)]],
        # 9. Galloping — syncopated kick, broken feel
        [[H(BD,120),H(CH,100)],[H(CH,80)],[H(CH,100)],[H(BD,80),H(CH,100)],[H(SD,110),H(CH,80)],[H(CH,100)],[H(BD,80),H(CH,100)],[H(CH,80)],[H(BD,120),H(CH,100)],[H(CH,80)],[H(CH,100)],[H(BD,80),H(CH,100)],[H(SD,110),H(CH,80)],[H(CH,100)],[H(BD,80),H(CH,100)],[H(OH,100)]],
        # 10. Acid Warehouse — doubled kick, OH accents
        [[H(BD,120),H(CH,100)],[H(CH,80)],[H(BD,80),H(CH,100)],[H(CH,80)],[H(BD,120),H(CP,120),H(OH,100)],[H(CH,80)],[H(CH,100)],[H(CH,80)],[H(BD,120),H(CH,100)],[H(CH,80)],[H(BD,80),H(CH,100)],[H(CH,80)],[H(BD,120),H(CP,120),H(OH,100)],[H(CH,80)],[H(CH,100)],[H(OH,100)]],
    ],

    # ── TRANCE ──
    "trance": [
        # 1. Euro Trance — 4/4, offbeat OH, CH on 16ths
        [[H(BD,120)],[H(CH,80)],[H(OH,100)],[H(CH,80)],[H(BD,100),H(CP,110)],[H(CH,80)],[H(OH,100)],[H(CH,80)],[H(BD,120)],[H(CH,80)],[H(OH,100)],[H(CH,80)],[H(BD,100),H(CP,110)],[H(CH,80)],[H(OH,100)],[H(CH,80)]],
        # 2. Driving — 16th hats with clap, no OH
        [[H(BD,120),H(CH,100)],[H(CH,60)],[H(CH,100)],[H(CH,60)],[H(BD,120),H(CP,120),H(CH,100)],[H(CH,60)],[H(CH,100)],[H(CH,60)],[H(BD,120),H(CH,100)],[H(CH,60)],[H(CH,100)],[H(CH,60)],[H(BD,120),H(CP,120),H(CH,100)],[H(CH,60)],[H(CH,100)],[H(CH,60)]],
        # 3. Breakdown — kick+clap only, sparse
        [[H(BD,100)],[],[],[],[H(CP,80)],[],[],[],[H(BD,100)],[],[],[],[H(CP,80)],[],[],[]],
        # 4. Uplifting — ride only, no hats
        [[H(BD,120),H(RD,100)],[H(RD,60)],[H(RD,100)],[H(RD,60)],[H(BD,100),H(CP,120)],[H(RD,60)],[H(RD,100)],[H(RD,60)],[H(BD,120),H(RD,100)],[H(RD,60)],[H(RD,100)],[H(RD,60)],[H(BD,100),H(CP,120)],[H(RD,60)],[H(RD,100)],[H(RD,60)]],
        # 5. Goa — 8th hats, OH accent, sparse
        [[H(BD,120),H(CH,100)],[],[H(CH,100)],[],[H(BD,100),H(CP,110),H(CH,100)],[],[H(OH,100)],[],[H(BD,120),H(CH,100)],[],[H(CH,100)],[],[H(BD,100),H(CP,110),H(CH,100)],[],[H(OH,100)],[]],
        # 6. Psy — dense 16th hats, SD on 2&4
        [[H(BD,120),H(CH,100)],[H(CH,100)],[H(CH,100)],[H(CH,100)],[H(BD,100),H(SD,110),H(CH,100)],[H(CH,100)],[H(CH,100)],[H(CH,100)],[H(BD,120),H(CH,100)],[H(CH,100)],[H(CH,100)],[H(CH,100)],[H(BD,100),H(SD,110),H(CH,100)],[H(CH,100)],[H(CH,100)],[H(OH,100)]],
        # 7. Rolling — doubled kick on 3 and 7, continuous hats
        [[H(BD,120),H(CH,80)],[H(CH,80)],[H(BD,80),H(CH,80)],[H(CH,80)],[H(BD,100),H(CP,110),H(CH,80)],[H(CH,80)],[H(BD,80),H(CH,80)],[H(CH,80)],[H(BD,120),H(CH,80)],[H(CH,80)],[H(BD,80),H(CH,80)],[H(CH,80)],[H(BD,100),H(CP,110),H(CH,80)],[H(CH,80)],[H(BD,80),H(CH,80)],[H(CH,80)]],
        # 8. Soft — gentle low-velocity version
        [[H(BD,80),H(CH,60)],[H(CH,50)],[H(CH,60)],[H(CH,50)],[H(CP,70),H(CH,60)],[H(CH,50)],[H(CH,60)],[H(CH,50)],[H(BD,80),H(CH,60)],[H(CH,50)],[H(CH,60)],[H(CH,50)],[H(CP,70),H(CH,60)],[H(CH,50)],[H(CH,60)],[H(OH,60)]],
        # 9. Hard Trance — doubled kick + OH offbeats, no CH
        [[H(BD,120)],[H(OH,80)],[H(BD,80)],[H(OH,80)],[H(BD,120),H(CP,120)],[H(OH,80)],[H(BD,80)],[H(OH,80)],[H(BD,120)],[H(OH,80)],[H(BD,80)],[H(OH,80)],[H(BD,120),H(CP,120)],[H(OH,80)],[H(BD,80)],[H(OH,80)]],
        # 10. Anthem Build — snare roll crescendo
        [[H(BD,120)],[H(SD,60)],[],[H(SD,70)],[H(BD,100),H(SD,80)],[H(SD,70)],[H(SD,80)],[H(SD,90)],[H(BD,120),H(SD,100)],[H(SD,90)],[H(SD,100)],[H(SD,100)],[H(SD,110)],[H(SD,110)],[H(SD,120)],[H(SD,120)]],
    ],

    # ── DUB-TECHNO ──
    "dub-techno": [
        # 1. Basic Channel — ultra-minimal
        [[H(BD,100)],[],[],[],[H(SD,70)],[],[],[],[H(BD,100)],[],[],[],[H(SD,70)],[],[],[]],
        # 2. Hazy — sparse with rimshot
        [[H(BD,100)],[],[H(RS,60)],[],[H(CH,60)],[],[H(RS,60)],[],[H(BD,100)],[],[H(RS,60)],[],[H(CH,60)],[],[H(RS,60)],[]],
        # 3. Echo Chamber — delayed-feel percussion
        [[H(BD,100),H(CH,60)],[],[H(CH,50)],[],[H(RS,70)],[],[H(CH,50)],[],[H(BD,100),H(CH,60)],[],[H(CH,50)],[],[H(RS,70)],[],[H(CH,50)],[]],
        # 4. Submerged — deep kick only
        [[H(BD,110)],[],[],[],[],[],[],[],[H(BD,100)],[],[],[],[],[],[],[]],
        # 5. Mist — gentle shaker-like hats
        [[H(BD,100),H(CH,50)],[H(CH,50)],[H(CH,50)],[H(CH,50)],[H(RS,60),H(CH,50)],[H(CH,50)],[H(CH,50)],[H(CH,50)],[H(BD,100),H(CH,50)],[H(CH,50)],[H(CH,50)],[H(CH,50)],[H(RS,60),H(CH,50)],[H(CH,50)],[H(CH,50)],[H(CH,50)]],
        # 6. Chain — sparse kick + delayed snare
        [[H(BD,110)],[],[],[],[],[],[H(SD,60)],[],[H(BD,100)],[],[],[],[],[],[H(SD,50)],[]],
        # 7. Fog — ride cymbal drift
        [[H(BD,100)],[],[H(RD,50)],[],[H(RD,60)],[],[H(RD,50)],[],[H(BD,100)],[],[H(RD,50)],[],[H(RD,60)],[],[H(RD,50)],[]],
        # 8. Depth — kick and open hat only
        [[H(BD,110)],[],[],[H(OH,60)],[],[],[],[H(OH,50)],[H(BD,100)],[],[],[H(OH,60)],[],[],[],[H(OH,50)]],
        # 9. Tape Hiss — ultra-sparse texture
        [[H(BD,100)],[],[],[],[],[],[],[],[],[],[],[],[H(RS,50)],[],[],[]],
        # 10. Detroit Dub — slightly more active
        [[H(BD,110),H(CH,60)],[],[H(CH,50)],[],[H(BD,80),H(SD,70),H(CH,60)],[],[H(CH,50)],[],[H(BD,110),H(CH,60)],[],[H(CH,50)],[],[H(BD,80),H(SD,70),H(CH,60)],[],[H(CH,50)],[]],
    ],

    # ── IDM ──
    "idm": [
        # 1. Broken Grid — irregular kick placement
        [[H(BD,120)],[],[H(SD,80)],[],[],[H(BD,90)],[],[H(SD,70)],[H(BD,100)],[],[],[H(SD,90)],[],[],[H(BD,80)],[]],
        # 2. Scatter — unpredictable
        [[H(BD,110)],[H(CH,60)],[],[],[H(CP,90)],[],[H(BD,70)],[H(CH,80)],[],[],[H(BD,100)],[H(SD,80)],[],[H(CH,60)],[],[H(RS,70)]],
        # 3. Micro Beats — rapid tiny hits
        [[H(CH,100)],[H(CH,60)],[H(CH,100)],[H(CH,60)],[H(BD,80),H(CH,100)],[H(CH,60)],[H(CH,100)],[H(CH,60)],[H(CH,100)],[H(CH,60)],[H(SD,70),H(CH,100)],[H(CH,60)],[H(CH,100)],[H(CH,60)],[H(CH,100)],[H(CH,60)]],
        # 4. Drill Pattern — rapid snare bursts
        [[H(BD,120)],[],[],[H(SD,100)],[H(SD,100)],[],[H(BD,80)],[],[],[H(SD,80)],[H(SD,80)],[H(SD,80)],[H(BD,100)],[],[],[H(SD,60)]],
        # 5. Polyrhythm — overlapping cycles
        [[H(BD,110),H(CH,80)],[],[H(CH,80)],[H(BD,70)],[],[H(CH,80)],[H(BD,70)],[],[H(CH,80)],[],[H(BD,70),H(CH,80)],[],[H(CH,80)],[H(BD,70)],[],[H(CH,80)]],
        # 6. Generative — seemingly random
        [[H(BD,100)],[],[H(RS,60)],[],[],[H(CH,70)],[],[H(BD,70)],[],[H(SD,80)],[],[],[H(CH,50)],[H(BD,90)],[],[H(RS,60)]],
        # 7. Glitch Beat — stuttering
        [[H(BD,120),H(CH,80)],[H(BD,60)],[],[H(CH,80)],[H(SD,100)],[H(SD,60)],[],[],[H(BD,100)],[H(BD,60)],[H(CH,80)],[],[H(SD,90)],[],[H(SD,60)],[H(CH,80)]],
        # 8. Ambient Percussion — gentle texture
        [[H(RS,60)],[],[],[H(CH,50)],[],[],[H(RS,50)],[],[],[H(CH,50)],[],[],[H(RS,60)],[],[H(CH,50)],[]],
        # 9. Asymmetric — odd grouping feel
        [[H(BD,110),H(CH,80)],[H(CH,60)],[H(CH,80)],[H(SD,90),H(CH,60)],[H(CH,80)],[H(BD,80),H(CH,60)],[H(CH,80)],[H(CH,60)],[H(CH,80)],[H(BD,100),H(SD,80),H(CH,60)],[H(CH,80)],[H(CH,60)],[H(CH,80)],[H(CH,60)],[H(BD,80),H(CH,80)],[H(CH,60)]],
        # 10. Warp — complex evolving
        [[H(BD,120)],[H(CH,80)],[H(BD,60)],[H(CH,60)],[H(SD,110)],[],[H(CH,80)],[H(BD,80)],[H(CH,60)],[H(BD,100)],[],[H(CH,80)],[H(SD,90),H(CH,60)],[H(BD,60)],[H(CH,80)],[]],
    ],

    # ── EDM ──
    "edm": [
        # 1. Festival — big room
        [[H(BD,120),H(CH,100)],[H(CH,60)],[H(CH,100)],[H(CH,60)],[H(BD,120),H(CP,120),H(CH,100)],[H(CH,60)],[H(CH,100)],[H(CH,60)],[H(BD,120),H(CH,100)],[H(CH,60)],[H(CH,100)],[H(CH,60)],[H(BD,120),H(CP,120),H(CH,100)],[H(CH,60)],[H(CH,100)],[H(CH,60)]],
        # 2. Drop Beat — heavy
        [[H(BD,120)],[],[H(BD,100)],[],[H(BD,120),H(CP,120)],[],[H(BD,100)],[],[H(BD,120)],[],[H(BD,100)],[],[H(BD,120),H(CP,120)],[],[H(BD,100)],[]],
        # 3. Buildup — snare fill
        [[H(BD,100)],[],[H(SD,60)],[],[H(BD,100),H(SD,70)],[],[H(SD,80)],[H(SD,80)],[H(BD,100),H(SD,90)],[H(SD,90)],[H(SD,100)],[H(SD,100)],[H(SD,110)],[H(SD,110)],[H(SD,120)],[H(SD,120)]],
        # 4. Bounce — offbeat kick
        [[H(BD,120),H(CH,100)],[H(CH,80)],[H(CH,100)],[H(BD,80),H(CH,80)],[H(CP,120),H(CH,100)],[H(CH,80)],[H(CH,100)],[H(BD,80),H(CH,80)],[H(BD,120),H(CH,100)],[H(CH,80)],[H(CH,100)],[H(BD,80),H(CH,80)],[H(CP,120),H(CH,100)],[H(CH,80)],[H(CH,100)],[H(BD,80),H(CH,80)]],
        # 5. Tropical — lighter, shuffle
        [[H(BD,100),H(CH,80)],[H(CH,60)],[H(CH,80)],[H(CH,60)],[H(CP,90),H(CH,80)],[H(CH,60)],[H(OH,80)],[H(CH,60)],[H(BD,100),H(CH,80)],[H(CH,60)],[H(CH,80)],[H(CH,60)],[H(CP,90),H(CH,80)],[H(CH,60)],[H(OH,80)],[H(CH,60)]],
        # 6. Stomper — four-on-floor heavy
        [[H(BD,120),H(CH,100)],[H(CH,100)],[H(BD,100),H(CH,100)],[H(CH,100)],[H(BD,120),H(CP,120),H(CH,100)],[H(CH,100)],[H(BD,100),H(CH,100)],[H(CH,100)],[H(BD,120),H(CH,100)],[H(CH,100)],[H(BD,100),H(CH,100)],[H(CH,100)],[H(BD,120),H(CP,120),H(CH,100)],[H(CH,100)],[H(BD,100),H(CH,100)],[H(CH,100)]],
        # 7. Future Bass — syncopated
        [[H(BD,110)],[],[],[H(CH,80)],[H(CP,100)],[],[H(BD,80)],[H(CH,80)],[],[],[H(BD,100)],[H(CH,80)],[H(CP,100)],[],[],[H(CH,80)]],
        # 8. Electro House — clap heavy
        [[H(BD,120),H(CH,80)],[H(CH,60)],[H(CH,80)],[H(CH,60)],[H(BD,100),H(CP,120),H(CH,80)],[H(CH,60)],[H(CP,70),H(CH,80)],[H(CH,60)],[H(BD,120),H(CH,80)],[H(CH,60)],[H(CH,80)],[H(CH,60)],[H(BD,100),H(CP,120),H(CH,80)],[H(CH,60)],[H(CP,70),H(CH,80)],[H(CH,60)]],
        # 9. Progressive — smooth build
        [[H(BD,100),H(CH,70)],[H(CH,60)],[H(CH,70)],[H(CH,60)],[H(BD,100),H(CP,80),H(CH,70)],[H(CH,60)],[H(CH,70)],[H(CH,60)],[H(BD,100),H(CH,70)],[H(CH,60)],[H(CH,70)],[H(CH,60)],[H(BD,100),H(CP,80),H(CH,70)],[H(CH,60)],[H(CH,70)],[H(OH,80)]],
        # 10. Mainstage Drop — maximum energy
        [[H(BD,120),H(CH,100)],[H(CH,100)],[H(BD,100),H(CH,100)],[H(CH,100)],[H(BD,120),H(CP,120),H(OH,100)],[H(CH,100)],[H(BD,100),H(CH,100)],[H(CH,100)],[H(BD,120),H(CH,100)],[H(CH,100)],[H(BD,100),H(CH,100)],[H(CH,100)],[H(BD,120),H(CP,120),H(OH,100)],[H(CH,100)],[H(BD,100),H(CH,100)],[H(OH,120)]],
    ],

    # ── DRUM-AND-BASS ──
    "drum-and-bass": [
        # 1. Two-Step — classic DnB
        [[H(BD,120),H(CH,100)],[H(CH,80)],[H(CH,100)],[H(CH,80)],[H(SD,120),H(CH,100)],[H(CH,80)],[H(CH,100)],[H(BD,80),H(CH,80)],[H(CH,100)],[H(CH,80)],[H(BD,100),H(CH,100)],[H(CH,80)],[H(SD,120),H(CH,100)],[H(CH,80)],[H(CH,100)],[H(CH,80)]],
        # 2. Roller — fast rolling hats
        [[H(BD,120),H(CH,100)],[H(CH,100)],[H(CH,100)],[H(CH,100)],[H(SD,110),H(CH,100)],[H(CH,100)],[H(CH,100)],[H(CH,100)],[H(BD,100),H(CH,100)],[H(CH,100)],[H(CH,100)],[H(CH,100)],[H(SD,110),H(CH,100)],[H(CH,100)],[H(CH,100)],[H(CH,100)]],
        # 3. Jungle Crossover — amen-style
        [[H(BD,120),H(CH,100)],[H(CH,80)],[H(CH,100)],[H(BD,80),H(CH,80)],[H(SD,120),H(CH,100)],[H(CH,80)],[H(BD,80),H(CH,100)],[H(CH,80)],[H(BD,100),H(CH,100)],[H(CH,80)],[H(CH,100)],[H(CH,80)],[H(SD,120),H(OH,100)],[H(CH,80)],[H(CH,100)],[H(BD,80),H(CH,80)]],
        # 4. Liquid — smooth flowing
        [[H(BD,110),H(CH,80)],[H(CH,60)],[H(CH,80)],[H(CH,60)],[H(SD,100),H(CH,80)],[H(CH,60)],[H(CH,80)],[H(CH,60)],[H(BD,90),H(CH,80)],[H(CH,60)],[H(CH,80)],[H(BD,70),H(CH,60)],[H(SD,100),H(CH,80)],[H(CH,60)],[H(CH,80)],[H(CH,60)]],
        # 5. Neuro — aggressive
        [[H(BD,120),H(CH,100)],[H(CH,100)],[H(BD,80),H(CH,100)],[H(CH,100)],[H(SD,120),H(CH,100)],[H(CH,100)],[H(CH,100)],[H(BD,100),H(CH,100)],[H(CH,100)],[H(BD,80),H(CH,100)],[H(CH,100)],[H(CH,100)],[H(SD,120),H(CH,100)],[H(CH,100)],[H(BD,80),H(CH,100)],[H(CH,100)]],
        # 6. Half-Time — slower feel
        [[H(BD,120),H(CH,80)],[H(CH,60)],[H(CH,80)],[H(CH,60)],[H(CH,80)],[H(CH,60)],[H(CH,80)],[H(CH,60)],[H(SD,110),H(CH,80)],[H(CH,60)],[H(CH,80)],[H(CH,60)],[H(CH,80)],[H(CH,60)],[H(BD,80),H(CH,80)],[H(CH,60)]],
        # 7. Syncopated — offbeat snares
        [[H(BD,120),H(CH,100)],[H(CH,80)],[H(CH,100)],[H(SD,80),H(CH,80)],[H(CH,100)],[H(CH,80)],[H(BD,80),H(CH,100)],[H(CH,80)],[H(SD,120),H(CH,100)],[H(CH,80)],[H(CH,100)],[H(CH,80)],[H(BD,80),H(CH,100)],[H(SD,80),H(CH,80)],[H(CH,100)],[H(CH,80)]],
        # 8. Minimal DnB — stripped back
        [[H(BD,110)],[],[],[],[H(SD,100)],[],[],[H(BD,80)],[],[],[H(BD,90)],[],[H(SD,100)],[],[],[]],
        # 9. Jump Up — energetic
        [[H(BD,120),H(CH,100)],[H(CH,100)],[H(CH,100)],[H(BD,80),H(CH,100)],[H(SD,120),H(CH,100)],[H(CH,100)],[H(BD,80),H(CH,100)],[H(CH,100)],[H(BD,100),H(CH,100)],[H(CH,100)],[H(CH,100)],[H(BD,80),H(CH,100)],[H(SD,120),H(CH,100)],[H(CH,100)],[H(CH,100)],[H(BD,80),H(CH,100)]],
        # 10. Drumfunk — complex breakbeat
        [[H(BD,110),H(CH,80)],[H(CH,70)],[H(SD,70),H(CH,80)],[H(CH,70)],[H(BD,80),H(CH,80)],[H(SD,60),H(CH,70)],[H(CH,80)],[H(BD,70),H(CH,70)],[H(SD,100),H(CH,80)],[H(CH,70)],[H(BD,70),H(CH,80)],[H(CH,70)],[H(SD,80),H(CH,80)],[H(CH,70)],[H(BD,80),H(CH,80)],[H(SD,60),H(CH,70)]],
    ],

    # ── HOUSE ──
    "house": [
        # 1. Classic — 4/4, offbeat OH, CH on 8ths
        [[H(BD,120)],[H(CH,80)],[H(OH,100)],[H(CH,80)],[H(BD,100),H(CP,110)],[H(CH,80)],[H(OH,100)],[H(CH,80)],[H(BD,120)],[H(CH,80)],[H(OH,100)],[H(CH,80)],[H(BD,100),H(CP,110)],[H(CH,80)],[H(OH,100)],[H(CH,80)]],
        # 2. Deep — kick + clap only
        [[H(BD,110)],[],[],[],[H(CP,90)],[],[],[],[H(BD,110)],[],[],[],[H(CP,90)],[],[],[]],
        # 3. Disco — 16th CH + offbeat OH
        [[H(BD,120),H(CH,100)],[H(CH,80)],[H(CH,100)],[H(CH,80)],[H(BD,100),H(CP,110),H(CH,100)],[H(CH,80)],[H(OH,100)],[H(CH,80)],[H(BD,120),H(CH,100)],[H(CH,80)],[H(CH,100)],[H(CH,80)],[H(BD,100),H(CP,110),H(CH,100)],[H(CH,80)],[H(OH,100)],[H(CH,80)]],
        # 4. Garage-Tinged — skippy kick, missing beats
        [[H(BD,110)],[H(CH,60)],[H(CH,80)],[],[H(CP,100),H(CH,80)],[H(CH,60)],[H(CH,80)],[H(BD,80)],[H(CH,80)],[H(CH,60)],[H(BD,100),H(CH,80)],[],[H(CP,100),H(CH,80)],[H(CH,60)],[H(CH,80)],[H(CH,60)]],
        # 5. Percussion — RS layered on 8ths
        [[H(BD,120),H(RS,60)],[H(CH,60)],[H(RS,60),H(CH,80)],[H(CH,60)],[H(BD,100),H(CP,100),H(RS,60)],[H(CH,60)],[H(RS,60),H(CH,80)],[H(CH,60)],[H(BD,120),H(RS,60)],[H(CH,60)],[H(RS,60),H(CH,80)],[H(CH,60)],[H(BD,100),H(CP,100),H(RS,60)],[H(CH,60)],[H(RS,60),H(CH,80)],[H(CH,60)]],
        # 6. Acid House — SD on 2&4, OH on offbeats, no ghost CH
        [[H(BD,120),H(CH,100)],[],[H(OH,100)],[],[H(BD,100),H(SD,100),H(CH,100)],[],[H(OH,100)],[],[H(BD,120),H(CH,100)],[],[H(OH,100)],[],[H(BD,100),H(SD,100),H(CH,100)],[],[H(OH,100)],[H(OH,80)]],
        # 7. Tech House — doubled kick, 16th CH
        [[H(BD,120),H(CH,80)],[H(CH,60)],[H(BD,80),H(CH,80)],[H(CH,60)],[H(BD,100),H(CP,100),H(CH,80)],[H(CH,60)],[H(CH,80)],[H(CH,60)],[H(BD,120),H(CH,80)],[H(CH,60)],[H(BD,80),H(CH,80)],[H(CH,60)],[H(BD,100),H(CP,100),H(CH,80)],[H(CH,60)],[H(CH,80)],[H(CH,60)]],
        # 8. Stripped — OH on 8ths, no CH
        [[H(BD,110)],[],[H(OH,80)],[],[H(CP,100)],[],[H(OH,80)],[],[H(BD,110)],[],[H(OH,80)],[],[H(CP,100)],[],[H(OH,80)],[]],
        # 9. Jackin — dense 16th CH, BD on every beat
        [[H(BD,120),H(CH,100)],[H(CH,100)],[H(BD,80),H(CH,100)],[H(CH,100)],[H(BD,120),H(CP,120),H(CH,100)],[H(CH,100)],[H(BD,80),H(CH,100)],[H(CH,100)],[H(BD,120),H(CH,100)],[H(CH,100)],[H(BD,80),H(CH,100)],[H(CH,100)],[H(BD,120),H(CP,120),H(CH,100)],[H(CH,100)],[H(BD,80),H(CH,100)],[H(OH,100)]],
        # 10. Afro House — CB+RS, 4 voices layered
        [[H(BD,120),H(CH,80)],[H(RS,70)],[H(CH,80)],[H(CB,60)],[H(BD,100),H(CP,100)],[H(RS,70)],[H(OH,80)],[H(CB,60)],[H(BD,120),H(CH,80)],[H(RS,70)],[H(CH,80)],[H(CB,60)],[H(BD,100),H(CP,100)],[H(RS,70)],[H(OH,80)],[H(CB,60)]],
    ],

    # ── BREAKBEAT ──
    "breakbeat": [
        # 1. Funky Break — syncopated kick
        [[H(BD,120),H(CH,80)],[H(CH,60)],[H(CH,80)],[],[H(SD,110),H(CH,80)],[H(CH,60)],[H(BD,80),H(CH,80)],[H(CH,60)],[H(CH,80)],[H(CH,60)],[H(BD,100),H(CH,80)],[],[H(SD,110),H(CH,80)],[H(CH,60)],[H(CH,80)],[H(BD,80)]],
        # 2. Big Beat — heavy
        [[H(BD,120)],[],[H(BD,80)],[],[H(SD,120)],[],[],[H(BD,100)],[],[],[H(BD,80)],[],[H(SD,120)],[],[H(BD,80)],[]],
        # 3. Nu Skool — modern breaks
        [[H(BD,110),H(CH,100)],[H(CH,80)],[H(CH,100)],[H(BD,70),H(CH,80)],[H(SD,100),H(CH,100)],[H(CH,80)],[H(CH,100)],[H(CH,80)],[H(BD,100),H(CH,100)],[H(CH,80)],[H(CH,100)],[H(CH,80)],[H(SD,100),H(OH,100)],[H(CH,80)],[H(BD,70),H(CH,100)],[H(CH,80)]],
        # 4. Dusty — lo-fi feel
        [[H(BD,100)],[],[H(CH,60)],[],[H(SD,80),H(CH,60)],[],[],[H(BD,70)],[],[H(CH,60)],[H(BD,80)],[],[H(SD,80),H(CH,60)],[],[H(CH,60)],[]],
        # 5. Rave — old-school rave breaks
        [[H(BD,120),H(CH,100)],[H(CH,80)],[H(BD,80),H(CH,100)],[H(CH,80)],[H(SD,120),H(OH,100)],[H(CH,80)],[H(CH,100)],[H(CH,80)],[H(BD,100),H(CH,100)],[H(CH,80)],[H(CH,100)],[H(BD,80),H(CH,80)],[H(SD,120),H(OH,100)],[H(CH,80)],[H(CH,100)],[H(CH,80)]],
        # 6. Percussion — cowbell + rimshot
        [[H(BD,110),H(CB,80)],[H(RS,60)],[H(CB,70)],[H(RS,60)],[H(SD,100),H(CB,80)],[H(RS,60)],[H(CB,70)],[H(RS,60)],[H(BD,100),H(CB,80)],[H(RS,60)],[H(CB,70)],[H(RS,60)],[H(SD,100),H(CB,80)],[H(RS,60)],[H(CB,70)],[H(RS,60)]],
        # 7. Half-Time — slower feel
        [[H(BD,120),H(CH,80)],[H(CH,60)],[H(CH,80)],[H(CH,60)],[H(CH,80)],[H(CH,60)],[H(CH,80)],[H(CH,60)],[H(SD,110),H(CH,80)],[H(CH,60)],[H(CH,80)],[H(CH,60)],[H(CH,80)],[H(CH,60)],[H(BD,80),H(CH,80)],[H(CH,60)]],
        # 8. Choppy — rapid fire
        [[H(BD,120)],[H(SD,60)],[H(BD,80)],[H(SD,60)],[H(SD,110)],[H(BD,60)],[H(SD,80)],[H(BD,60)],[H(BD,100)],[H(SD,60)],[H(BD,80)],[H(SD,60)],[H(SD,110)],[H(BD,60)],[H(BD,80)],[H(SD,60)]],
        # 9. Filtered — dynamic velocity
        [[H(BD,120),H(CH,50)],[H(CH,60)],[H(CH,70)],[H(CH,80)],[H(SD,100),H(CH,90)],[H(CH,100)],[H(CH,90)],[H(CH,80)],[H(BD,100),H(CH,70)],[H(CH,60)],[H(CH,50)],[H(CH,60)],[H(SD,100),H(CH,70)],[H(CH,80)],[H(CH,90)],[H(CH,100)]],
        # 10. Warehouse — raw energy
        [[H(BD,120),H(OH,100)],[],[H(BD,80)],[],[H(SD,120),H(OH,100)],[],[],[H(BD,100)],[H(OH,100)],[],[H(BD,80),H(OH,80)],[],[H(SD,120)],[],[H(BD,80)],[H(OH,100)]],
    ],

    # ── JUNGLE ──
    "jungle": [
        # 1. Amen Classic — amen break pattern
        [[H(BD,120),H(CH,100)],[H(CH,80)],[H(CH,100)],[H(BD,80),H(CH,80)],[H(SD,120),H(CH,100)],[H(CH,80)],[H(BD,80),H(CH,100)],[H(CH,80)],[H(BD,100),H(CH,100)],[H(CH,80)],[H(CH,100)],[H(CH,80)],[H(SD,120),H(OH,100)],[H(CH,80)],[H(BD,80),H(CH,100)],[H(BD,60),H(CH,80)]],
        # 2. Chopped — sliced break
        [[H(BD,120),H(CH,100)],[H(SD,60),H(CH,80)],[H(CH,100)],[H(BD,80)],[H(SD,120),H(CH,100)],[H(CH,80)],[H(BD,60),H(SD,60),H(CH,100)],[H(CH,80)],[H(BD,100),H(CH,100)],[H(CH,80)],[H(SD,80),H(CH,100)],[H(CH,80)],[H(SD,120)],[H(BD,60),H(CH,80)],[H(CH,100)],[H(SD,70),H(CH,80)]],
        # 3. Ragga — reggae-influenced rhythm
        [[H(BD,110),H(CH,80)],[H(CH,80)],[H(CH,80)],[H(CH,80)],[H(SD,100),H(CH,80)],[H(CH,80)],[H(CH,80)],[H(BD,80),H(CH,80)],[H(CH,80)],[H(CH,80)],[H(BD,90),H(CH,80)],[H(CH,80)],[H(SD,100),H(CH,80)],[H(CH,80)],[H(CH,80)],[H(BD,70),H(CH,80)]],
        # 4. Dark — menacing
        [[H(BD,120)],[],[H(CH,80)],[],[H(SD,120)],[],[H(BD,80),H(CH,80)],[],[H(BD,100)],[H(CH,80)],[],[],[H(SD,110),H(OH,100)],[],[H(BD,80)],[H(CH,80)]],
        # 5. Roller — fast rolling
        [[H(BD,120),H(CH,100)],[H(CH,100)],[H(CH,100)],[H(BD,80),H(CH,100)],[H(SD,110),H(CH,100)],[H(CH,100)],[H(CH,100)],[H(CH,100)],[H(BD,100),H(CH,100)],[H(CH,100)],[H(CH,100)],[H(BD,70),H(CH,100)],[H(SD,110),H(CH,100)],[H(CH,100)],[H(CH,100)],[H(CH,100)]],
        # 6. Steppers — steady stepping
        [[H(BD,110),H(CH,80)],[H(CH,60)],[H(CH,80)],[H(CH,60)],[H(SD,100),H(CH,80)],[H(CH,60)],[H(CH,80)],[H(CH,60)],[H(BD,100),H(CH,80)],[H(CH,60)],[H(CH,80)],[H(CH,60)],[H(SD,100),H(CH,80)],[H(CH,60)],[H(CH,80)],[H(CH,60)]],
        # 7. Apache — Apache break style
        [[H(BD,120),H(CH,80)],[H(CH,60)],[H(CH,80)],[H(BD,70),H(CH,60)],[H(SD,110),H(CH,80)],[H(CH,60)],[H(CH,80)],[H(CH,60)],[H(BD,80),H(SD,70),H(CH,80)],[H(CH,60)],[H(BD,80),H(CH,80)],[H(CH,60)],[H(SD,110),H(CH,80)],[H(CH,60)],[H(BD,70),H(CH,80)],[H(CH,60)]],
        # 8. Ghost — ghost note heavy
        [[H(BD,110),H(CH,80)],[H(SD,50),H(CH,60)],[H(CH,80)],[H(SD,50),H(CH,60)],[H(SD,110),H(CH,80)],[H(SD,50),H(CH,60)],[H(CH,80)],[H(BD,70),H(SD,50),H(CH,60)],[H(BD,90),H(CH,80)],[H(SD,50),H(CH,60)],[H(CH,80)],[H(SD,50),H(CH,60)],[H(SD,110),H(CH,80)],[H(SD,50),H(CH,60)],[H(CH,80)],[H(SD,50),H(CH,60)]],
        # 9. Rewind — building intensity
        [[H(BD,100),H(CH,80)],[H(CH,80)],[H(CH,80)],[H(CH,80)],[H(SD,80),H(CH,80)],[H(CH,80)],[H(CH,80)],[H(BD,80),H(CH,80)],[H(SD,90),H(CH,80)],[H(CH,80)],[H(BD,80),H(CH,80)],[H(CH,80)],[H(SD,100),H(OH,100)],[H(CH,80)],[H(BD,80),H(SD,80),H(CH,80)],[H(SD,70),H(CH,80)]],
        # 10. Think Break — classic break pattern
        [[H(BD,120),H(CH,100)],[H(CH,80)],[H(CH,100)],[H(CH,80)],[H(SD,110),H(CH,100)],[H(CH,80)],[H(CH,100)],[H(BD,80),H(CH,80)],[H(CH,100)],[H(BD,70),H(CH,80)],[H(CH,100)],[H(CH,80)],[H(SD,110),H(CH,100)],[H(CH,80)],[H(BD,80),H(CH,100)],[H(CH,80)]],
    ],

    # ── GARAGE ──
    "garage": [
        # 1. 2-Step Classic — skippy kick, CH on 16ths
        [[H(BD,110)],[H(CH,70)],[H(CH,80)],[],[H(CP,100),H(CH,80)],[H(CH,70)],[H(CH,80)],[H(BD,80)],[H(CH,80)],[H(CH,70)],[H(BD,100),H(CH,80)],[],[H(CP,100),H(CH,80)],[H(CH,70)],[H(CH,80)],[H(CH,70)]],
        # 2. Shuffled — swing feel, RS on 2&4, ghost hats
        [[H(BD,110),H(CH,80)],[H(CH,50)],[H(CH,80)],[H(CH,50)],[H(RS,90),H(CH,80)],[H(CH,50)],[H(CH,80)],[H(BD,70),H(CH,50)],[H(CH,80)],[H(CH,50)],[H(BD,90),H(CH,80)],[H(CH,50)],[H(RS,90),H(CH,80)],[H(CH,50)],[H(CH,80)],[H(CH,50)]],
        # 3. Rimshot Bounce — RS on 2&4, sparser hats
        [[H(BD,110),H(CH,80)],[],[H(CH,80)],[],[H(RS,100),H(CH,80)],[],[H(CH,80)],[H(BD,70)],[H(CH,80)],[],[H(BD,90),H(CH,80)],[],[H(RS,100),H(CH,80)],[],[H(CH,80)],[]],
        # 4. Speed Garage — busier, skip kicks, OH accent
        [[H(BD,120),H(CH,100)],[H(CH,80)],[H(CH,100)],[H(BD,80),H(CH,80)],[H(CP,110),H(CH,100)],[H(CH,80)],[H(OH,100)],[H(CH,80)],[H(BD,100),H(CH,100)],[H(CH,80)],[H(CH,100)],[H(BD,70),H(CH,80)],[H(CP,110),H(CH,100)],[H(CH,80)],[H(OH,100)],[H(CH,80)]],
        # 5. Broken — very sparse, irregular
        [[H(BD,100)],[],[H(CH,70)],[],[H(RS,80)],[],[],[H(BD,70),H(CH,70)],[],[],[H(BD,80)],[],[H(RS,80)],[],[H(CH,70)],[]],
        # 6. Clap Garage — CP on 2&4, OH accents, unique hit pattern
        [[H(BD,110),H(CH,80)],[H(CH,60)],[H(OH,80)],[H(CH,60)],[H(CP,110),H(CH,80)],[H(CH,60)],[H(CH,80)],[H(BD,70)],[H(CH,80)],[H(CH,60)],[H(BD,90),H(OH,80)],[H(CH,60)],[H(CP,110),H(CH,80)],[H(CH,60)],[H(OH,80)],[H(CH,60)]],
        # 7. Percussive — rimshots + cowbell layered
        [[H(BD,100),H(RS,60)],[H(CH,60)],[H(RS,70),H(CH,70)],[H(CH,60)],[H(CP,90),H(RS,60)],[H(CH,60)],[H(RS,70),H(CH,70)],[H(BD,70),H(CH,60)],[H(RS,60),H(CH,70)],[H(CH,60)],[H(BD,80),H(RS,70),H(CH,70)],[H(CH,60)],[H(CP,90),H(RS,60)],[H(CH,60)],[H(RS,70),H(CH,70)],[H(CH,60)]],
        # 8. Deep 2-Step — very minimal, kick+RS only
        [[H(BD,100)],[],[],[],[H(RS,80)],[],[],[H(BD,70)],[],[],[H(BD,80)],[],[H(RS,80)],[],[],[]],
        # 9. UKG Roller — rolling 16th hats, OH at end
        [[H(BD,110),H(CH,100)],[H(CH,80)],[H(CH,100)],[H(CH,80)],[H(RS,100),H(CH,100)],[H(CH,80)],[H(CH,100)],[H(BD,70),H(CH,80)],[H(CH,100)],[H(CH,80)],[H(BD,90),H(CH,100)],[H(CH,80)],[H(RS,100),H(CH,100)],[H(CH,80)],[H(OH,100)],[H(CH,80)]],
        # 10. Night Garage — dark, OH on offbeats
        [[H(BD,110)],[H(OH,60)],[H(CH,70)],[H(OH,50)],[H(CP,90)],[H(OH,60)],[H(CH,70)],[H(BD,70),H(OH,50)],[],[H(OH,60)],[H(BD,80),H(CH,70)],[H(OH,50)],[H(CP,90)],[H(OH,60)],[H(CH,70)],[H(OH,50)]],
    ],

    # ── AMBIENT ──
    "ambient": [
        # 1. Breath — single kick pulse
        [[H(BD,70)],[],[],[],[],[],[],[],[],[],[],[],[],[],[],[]],
        # 2. Mist — faint hi-hat texture
        [[H(CH,50)],[],[],[],[],[],[],[],[H(CH,50)],[],[],[],[],[],[],[]],
        # 3. Rain — sparse random-feel percussion
        [[],[],[],[H(RS,50)],[],[],[],[],[],[],[],[],[],[],[H(RS,50)],[]],
        # 4. Void — near silence, single hit
        [[],[],[],[],[],[],[],[],[H(RD,50)],[],[],[],[],[],[],[]],
        # 5. Pulse — gentle kick + hat
        [[H(BD,60),H(CH,50)],[],[],[],[],[],[],[],[H(BD,60)],[],[],[],[],[],[],[]],
        # 6. Shimmer — ride only
        [[],[],[],[],[H(RD,50)],[],[],[],[],[],[],[],[],[],[],[]],
        # 7. Tide — two gentle hits
        [[H(BD,60)],[],[],[],[],[],[],[],[],[],[],[],[H(RS,50)],[],[],[]],
        # 8. Crystal — sparse metallic
        [[],[],[],[],[],[],[],[],[],[],[],[H(CB,50)],[],[],[],[]],
        # 9. Drift — minimal textural
        [[H(CH,50)],[],[],[],[],[],[],[H(OH,50)],[],[],[],[],[],[],[],[]],
        # 10. Horizon — wide spacing
        [[H(BD,60)],[],[],[],[],[],[],[],[],[],[],[],[],[],[],[H(CH,50)]],
    ],

    # ── GLITCH ──
    "glitch": [
        # 1. Buffer — stuttering repeats
        [[H(BD,120)],[H(BD,60)],[],[],[H(SD,100)],[H(SD,50)],[],[],[H(BD,100)],[H(BD,50)],[],[],[H(SD,80)],[H(SD,50)],[],[]],
        # 2. Micro — tiny clicks
        [[H(RS,80)],[H(RS,50)],[],[H(CH,60)],[],[],[H(RS,80)],[],[],[H(CH,60)],[H(RS,50)],[],[],[],[H(RS,80)],[H(CH,60)]],
        # 3. Scatter — random placement
        [[H(BD,100)],[],[],[H(CH,80)],[],[H(SD,70)],[],[],[H(CH,60)],[],[],[],[H(BD,80)],[],[H(RS,60)],[]],
        # 4. Stutter Kick — rapid kick stuttering
        [[H(BD,120)],[H(BD,100)],[H(BD,80)],[H(BD,60)],[],[],[],[],[H(BD,120)],[H(BD,100)],[H(BD,80)],[H(BD,60)],[],[],[],[]],
        # 5. Digital Debris — irregular percussion
        [[H(RS,80)],[],[H(CB,60)],[],[],[H(CH,70)],[],[H(RS,50)],[],[H(CB,70)],[],[],[H(CH,80)],[],[],[H(RS,60)]],
        # 6. Tape Stop — decelerating
        [[H(BD,120),H(CH,100)],[H(CH,90)],[H(CH,80)],[H(CH,70)],[H(SD,80),H(CH,60)],[H(CH,50)],[],[],[],[],[],[],[],[],[],[]],
        # 7. Reboot — silence then burst
        [[],[],[],[],[],[],[],[],[],[],[H(BD,120)],[H(SD,100)],[H(CH,100)],[H(BD,100)],[H(SD,80)],[H(CH,80)]],
        # 8. Granular — dense tiny hits
        [[H(CH,80)],[H(RS,60)],[H(CH,70)],[H(RS,50)],[H(CH,80)],[H(RS,60)],[H(CH,70)],[H(RS,50)],[H(CH,80)],[H(RS,60)],[H(CH,70)],[H(RS,50)],[H(CH,80)],[H(RS,60)],[H(CH,70)],[H(RS,50)]],
        # 9. Freeze Frame — repeating fragment
        [[H(BD,100),H(CH,80)],[H(SD,60)],[H(BD,100),H(CH,80)],[H(SD,60)],[],[],[],[],[H(BD,100),H(CH,80)],[H(SD,60)],[],[],[],[],[],[]],
        # 10. Error — intentionally wrong
        [[H(SD,120)],[],[],[],[H(BD,80)],[],[H(SD,60)],[],[],[H(BD,100)],[],[],[H(SD,80)],[H(BD,60)],[],[]],
    ],

    # ── ELECTRO ──
    "electro": [
        # 1. 808 Classic — classic electro beat
        [[H(BD,120),H(CH,100)],[H(CH,80)],[H(CH,100)],[H(CH,80)],[H(CP,110),H(CH,100)],[H(CH,80)],[H(CH,100)],[H(CH,80)],[H(BD,100),H(CH,100)],[H(CH,80)],[H(BD,80),H(CH,100)],[H(CH,80)],[H(CP,110),H(CH,100)],[H(CH,80)],[H(CH,100)],[H(CH,80)]],
        # 2. Cowbell — classic cowbell pattern
        [[H(BD,120),H(CB,100)],[H(CH,80)],[H(CB,80),H(CH,80)],[H(CH,80)],[H(CP,110),H(CB,100)],[H(CH,80)],[H(CB,80),H(CH,80)],[H(CH,80)],[H(BD,100),H(CB,100)],[H(CH,80)],[H(CB,80),H(CH,80)],[H(CH,80)],[H(CP,110),H(CB,100)],[H(CH,80)],[H(CB,80),H(CH,80)],[H(CH,80)]],
        # 3. Robot — mechanical precision
        [[H(BD,120)],[H(CH,100)],[H(BD,80)],[H(CH,100)],[H(CP,120)],[H(CH,100)],[H(BD,80)],[H(CH,100)],[H(BD,120)],[H(CH,100)],[H(BD,80)],[H(CH,100)],[H(CP,120)],[H(CH,100)],[H(BD,80)],[H(CH,100)]],
        # 4. Breakdance — b-boy beat
        [[H(BD,120),H(CH,80)],[H(CH,60)],[H(CH,80)],[],[H(SD,110),H(CH,80)],[H(CH,60)],[H(BD,80),H(CH,80)],[H(CH,60)],[H(CH,80)],[],[H(BD,100),H(CH,80)],[H(CH,60)],[H(SD,110),H(CH,80)],[H(CH,60)],[H(CH,80)],[H(BD,80)]],
        # 5. Kraftwerk — minimal robotic
        [[H(BD,100)],[],[H(CH,80)],[],[H(SD,80)],[],[H(CH,80)],[],[H(BD,100)],[],[H(CH,80)],[],[H(SD,80)],[],[H(CH,80)],[]],
        # 6. Miami Bass — boomy kick
        [[H(BD,120)],[],[H(BD,100)],[],[H(CP,110)],[],[H(BD,80)],[],[H(BD,120)],[],[H(BD,100)],[],[H(CP,110)],[],[],[H(BD,80)]],
        # 7. Zapp — funky electro
        [[H(BD,120),H(CH,100)],[H(CH,80)],[H(OH,100)],[H(CH,80)],[H(CP,110),H(CH,100)],[H(CH,80)],[H(OH,100)],[H(BD,80),H(CH,80)],[H(BD,100),H(CH,100)],[H(CH,80)],[H(OH,100)],[H(CH,80)],[H(CP,110),H(CH,100)],[H(CH,80)],[H(OH,100)],[H(CH,80)]],
        # 8. Industrial Electro — heavy
        [[H(BD,120),H(CH,100)],[H(CH,100)],[H(BD,80),H(CH,100)],[H(CH,100)],[H(SD,120),H(CH,100)],[H(CH,100)],[H(BD,80),H(CH,100)],[H(CH,100)],[H(BD,120),H(CH,100)],[H(CH,100)],[H(BD,80),H(CH,100)],[H(CH,100)],[H(SD,120),H(CH,100)],[H(CH,100)],[H(BD,80),H(CH,100)],[H(CH,100)]],
        # 9. Minimal Electro — sparse
        [[H(BD,110)],[],[],[],[H(CP,90)],[],[],[],[H(BD,100)],[],[H(BD,70)],[],[H(CP,90)],[],[],[]],
        # 10. Electro Funk — groovy
        [[H(BD,120),H(CH,80)],[H(CH,60)],[H(BD,70),H(CH,80)],[H(CH,60)],[H(CP,100),H(OH,80)],[H(CH,60)],[H(CH,80)],[H(BD,80),H(CH,60)],[H(BD,100),H(CH,80)],[H(CH,60)],[H(CH,80)],[H(CH,60)],[H(CP,100),H(OH,80)],[H(CH,60)],[H(BD,70),H(CH,80)],[H(CH,60)]],
    ],

    # ── DOWNTEMPO ──
    "downtempo": [
        # 1. Trip Hop — classic Bristol beat
        [[H(BD,100),H(CH,60)],[],[H(CH,60)],[],[H(SD,80),H(CH,60)],[],[H(CH,60)],[H(BD,70)],[],[H(CH,60)],[H(BD,80),H(CH,60)],[],[H(SD,80),H(CH,60)],[],[H(CH,60)],[]],
        # 2. Downtempo Minimal — sparse
        [[H(BD,90)],[],[],[],[H(SD,70)],[],[],[],[H(BD,80)],[],[],[],[H(SD,70)],[],[],[]],
        # 3. Lo-Fi — dusty feel
        [[H(BD,90),H(CH,50)],[H(CH,50)],[H(CH,50)],[H(CH,50)],[H(SD,70),H(CH,50)],[H(CH,50)],[H(CH,50)],[H(BD,60),H(CH,50)],[H(CH,50)],[H(CH,50)],[H(BD,70),H(CH,50)],[H(CH,50)],[H(SD,70),H(CH,50)],[H(CH,50)],[H(CH,50)],[H(CH,50)]],
        # 4. Jazz Brush — gentle brush strokes
        [[H(BD,80),H(RD,60)],[H(RD,50)],[H(RD,60)],[H(RD,50)],[H(SD,60),H(RD,60)],[H(RD,50)],[H(RD,60)],[H(RD,50)],[H(BD,70),H(RD,60)],[H(RD,50)],[H(RD,60)],[H(RD,50)],[H(SD,60),H(RD,60)],[H(RD,50)],[H(RD,60)],[H(RD,50)]],
        # 5. Heavy — slow and powerful
        [[H(BD,120)],[],[],[],[H(SD,100)],[],[],[],[H(BD,110)],[],[],[],[H(SD,100)],[],[],[]],
        # 6. Shuffle — swung rhythm
        [[H(BD,90),H(CH,70)],[],[H(CH,60)],[H(BD,60)],[H(SD,80),H(CH,70)],[],[H(CH,60)],[],[H(BD,80),H(CH,70)],[],[H(CH,60)],[H(BD,60)],[H(SD,80),H(CH,70)],[],[H(CH,60)],[]],
        # 7. Ambient Beat — barely there
        [[H(BD,60)],[],[],[],[],[],[],[],[H(SD,50)],[],[],[],[],[],[],[]],
        # 8. Boom Bap — hip-hop crossover
        [[H(BD,110)],[],[],[],[H(SD,90)],[],[],[H(BD,80)],[],[],[H(BD,90)],[],[H(SD,90)],[],[],[]],
        # 9. Organic — natural feel
        [[H(BD,80),H(RS,50)],[],[H(RS,50)],[],[H(SD,70),H(RS,50)],[],[H(RS,50)],[H(BD,60)],[],[H(RS,50)],[H(BD,70),H(RS,50)],[],[H(SD,70),H(RS,50)],[],[H(RS,50)],[]],
        # 10. Cinematic — dramatic sparse
        [[H(BD,100)],[],[],[],[],[],[],[],[],[],[],[],[H(CY,80)],[],[],[]],
    ],
}


# ─── T-8 BASS PATTERNS ───────────────────────────────────

def bass_patterns_for(genre):
    """Return list of 10 new T-8 bass patterns for the given genre."""
    return BASS_PATTERNS[genre]


BASS_PATTERNS = {
    # ── TECHNO ──
    "techno": [
        # 1. Chromatic Return — 8th root with chromatic passing
        [N(0,1.3), R, N(0,1.0), R, N(0,1.3), R, N(0,1.0), R, N(0,1.3), R, N(-2,1.0,True), R, N(0,1.3), R, N(0,1.0), R],
        # 2. Quarter Pound — heavy quarter-note root with accent variation (differs from Quarter Sub)
        [N(0,1.3), R, R, R, N(0,0.8), R, R, R, N(0,1.3), R, R, R, N(0,0.8), R, R, R],
        # 3. Ghost Pump — 16th with ghost dynamics
        [N(0,1.3), N(0,0.5), N(0,1.0), N(0,0.5), N(0,1.3), N(0,0.5), N(0,1.0), N(0,0.5), N(0,1.3), N(0,0.5), N(0,1.0), N(0,0.5), N(0,1.3), N(0,0.5), N(0,1.0), N(0,0.5)],
        # 4. Octave Drop — sub and root, dotted feel
        [N(-12,1.3), R, R, N(0,0.8), R, R, N(-12,1.3), R, R, N(0,0.8), R, R, N(-12,1.3), R, R, R],
        # 5. Fifth Drive — root-5th with syncopated rest
        [N(0,1.3), R, N(7,1.0), R, N(0,1.3), R, R, N(7,0.8), N(0,1.3), R, N(5,1.0), R, N(0,1.3), R, N(7,1.0), R],
        # 6. Dotted Pulse — dotted 8th feel (3-step grouping)
        [N(0,1.3), R, R, N(0,0.8), R, R, N(0,1.3), R, R, N(0,0.8), R, R, N(0,1.3), R, R, N(0,0.8)],
        # 7. Minor Walk — root to b7, odd grouping
        [N(0,1.2), R, N(0,0.8), R, N(0,1.2), R, N(-2,0.8), R, N(-5,1.2), R, R, N(-5,0.8), N(0,1.2), R, N(-2,0.8), R],
        # 8. Sub Heartbeat — half-note deep pulse
        [N(0,1.3), R, R, R, R, R, R, R, N(0,1.3), R, R, R, R, R, R, R],
        # 9. Triad Walk — root-b3-5-b7 with rest variation
        [N(0,1.3), R, N(3,1.0), R, N(0,1.3), R, N(5,0.8), R, N(0,1.3), R, N(3,1.0), N(7,1.2), R, R, N(5,0.8), R],
        # 10. Sliding Octave — root-sub with slides
        [N(0,1.2,True), R, N(-12,1.0,True), R, N(0,1.2,True), R, N(-12,1.0,True), R, N(0,1.2,True), R, N(-12,1.0,True), R, N(0,1.2,True), N(-12,0.8,True), R, R],
    ],

    # ── ACID-TECHNO ──
    "acid-techno": [
        [N(0,1.3), N(12,1.0,True), N(0,1.3), R, N(10,1.0,True), N(0,1.3), R, N(12,1.0,True), N(0,1.3), N(10,1.0,True), R, N(0,1.3), R, N(12,1.0,True), N(10,1.0,True), N(0,1.3)],
        [N(0,1.3,True), N(3,1.0,True), N(5,1.0,True), N(7,1.3,True), N(5,1.0,True), N(3,1.0,True), N(0,1.3), R, N(0,1.3,True), N(5,1.0,True), N(7,1.0,True), N(10,1.3,True), N(7,1.0,True), N(5,1.0,True), N(0,1.3), R],
        [N(0,1.3), R, N(0,1.0), N(-2,1.0,True), N(0,1.3), R, N(3,1.0,True), N(5,1.3), R, N(3,1.0,True), N(0,1.3), R, N(-2,1.0,True), N(0,1.3), R, R],
        [N(-12,1.3), R, N(0,1.0,True), R, N(-12,1.3), R, N(0,1.0,True), N(3,1.0,True), N(-12,1.3), R, N(0,1.0,True), R, N(-12,1.3), R, N(5,1.0,True), N(3,1.0,True)],
        [N(0,1.3), N(0,1.0), N(0,1.3), N(0,1.0), N(12,1.3,True), N(0,1.0), N(0,1.3), N(0,1.0), N(0,1.3), N(0,1.0), N(10,1.3,True), N(0,1.0), N(0,1.3), N(0,1.0), N(12,1.3,True), N(10,1.0,True)],
        [N(0,1.3,True), R, N(7,1.0,True), R, N(0,1.3,True), R, N(10,1.0,True), R, N(0,1.3,True), R, N(7,1.0,True), R, N(12,1.3,True), R, N(10,1.0,True), R],
        [N(0,1.3), N(1,1.0,True), N(0,1.3), N(-1,1.0,True), N(0,1.3), N(2,1.0,True), N(0,1.3), N(-2,1.0,True), N(0,1.3), N(3,1.0,True), N(0,1.3), N(-1,1.0,True), N(0,1.3), N(5,1.0,True), N(3,1.0,True), N(0,1.3)],
        [N(0,1.3), R, R, R, N(12,1.0,True), R, R, R, N(0,1.3), R, R, R, N(10,1.0,True), R, R, R],
        [N(0,1.3,True), N(0,1.0), N(3,1.0,True), R, N(0,1.3,True), N(5,1.0,True), N(7,1.3), R, N(0,1.3,True), N(0,1.0), N(3,1.0,True), R, N(5,1.3), N(3,1.0,True), N(0,1.3), R],
        [N(0,1.3), N(0,1.3), R, R, N(0,1.3), N(12,1.0,True), R, N(10,1.0,True), N(0,1.3), N(0,1.3), R, R, N(12,1.3,True), N(10,1.0,True), N(0,1.3), R],
    ],

    # ── TRANCE ──
    "trance": [
        # 1. Offbeat Pump — classic offbeat root
        [R, N(0,1.3), R, N(0,0.8), R, N(0,1.3), R, N(0,0.8), R, N(0,1.3), R, N(0,0.8), R, N(0,1.3), R, N(0,0.8)],
        # 2. Fifth Bounce — root-5th alternating 8ths
        [N(0,1.3), R, N(7,0.8), R, N(0,1.3), R, N(12,0.8), R, N(0,1.3), R, N(7,0.8), R, N(5,1.3), R, N(7,0.8), R],
        # 3. Quarter Root — quarter-note root + fifth
        [N(0,1.3), R, R, R, N(0,0.8), R, R, R, N(7,1.3), R, R, R, N(7,0.8), R, R, R],
        # 4. Gallop — triplet-feel root pulse
        [N(0,1.3), N(0,0.8), R, N(0,0.8), N(0,1.3), R, N(0,0.8), N(0,1.3), R, N(0,0.8), N(0,1.3), R, N(7,1.3), N(7,0.8), R, N(7,0.8)],
        # 5. Dynamic Pump — accented with gaps
        [N(0,1.3), R, N(0,0.5), R, N(0,1.3), R, R, R, N(5,1.3), R, N(5,0.5), R, N(7,1.3), R, R, R],
        # 6. Slide Root — sliding root to fifth, very sparse
        [N(0,1.3,True), R, R, R, N(7,0.8,True), R, R, R, N(0,1.3,True), R, R, R, N(5,0.8,True), R, R, R],
        # 7. Offbeat Fifth — offbeat pairs with rest
        [R, N(0,1.3), R, N(0,0.8), R, N(7,1.3), R, R, R, N(0,1.3), R, N(0,0.8), R, N(12,1.3), R, R],
        # 8. Stutter Pump — dense root stutter + fifth
        [N(0,1.3), R, N(0,0.8), N(0,0.5), R, N(0,1.3), R, N(0,0.8), N(7,1.3), R, N(7,0.8), N(7,0.5), R, N(7,1.3), R, N(7,0.8)],
        # 9. Walking Trance — ascending scale with syncopation
        [N(0,1.3), R, N(3,0.8), N(5,1.3), R, R, N(7,0.8), R, N(5,1.3), R, N(3,0.8), N(0,1.3), R, R, N(-2,0.8), R],
        # 10. Dotted Root — dotted 8th feel
        [N(0,1.3), R, R, N(0,0.8), R, R, N(0,1.3), R, R, N(7,1.3), R, R, N(0,1.3), R, R, N(12,0.8)],
    ],

    # ── DUB-TECHNO ──
    "dub-techno": [
        # 1. Heartbeat — half-note with decay
        [N(0,1.0), R, R, R, R, R, R, R, N(0,0.7), R, R, R, R, R, R, R],
        # 2. Single Tone — one note per bar
        [N(0,1.0), R, R, R, R, R, R, R, R, R, R, R, R, R, R, R],
        # 3. Slide Fifth — root with sliding fifth, wide
        [N(0,1.0,True), R, R, R, R, R, N(7,0.7,True), R, R, R, R, R, R, R, R, R],
        # 4. Sub Drift — root to b7, offset placement
        [R, R, R, R, N(0,1.0), R, R, R, R, R, R, R, N(-2,0.8), R, R, R],
        # 5. Echo Bass — fading repeats, 3 hits
        [N(0,1.0), R, R, N(0,0.7), R, R, N(0,0.5), R, R, R, R, R, R, R, R, R],
        # 6. Offbeat Root — offbeat placement
        [R, R, R, R, N(0,0.9), R, R, R, R, R, R, R, N(0,0.9), R, R, R],
        # 7. Deep Sub — sub-octave root, late in bar
        [R, R, R, R, R, R, R, R, R, R, R, R, N(-12,1.0), R, R, R],
        # 8. Fifth Drift — root then fifth then root
        [N(0,1.0), R, R, R, R, R, N(7,0.7), R, R, R, R, R, N(0,0.8), R, R, R],
        # 9. Quarter Pulse — gentle quarter-note root
        [N(0,1.0), R, R, R, N(0,0.7), R, R, R, N(0,1.0), R, R, R, N(0,0.7), R, R, R],
        # 10. Minor Slide — root to minor 3rd slide, very sparse
        [N(0,0.9,True), R, R, R, R, R, R, R, R, R, R, R, N(3,0.7,True), R, R, R],
    ],

    # ── IDM ──
    "idm": [
        [N(0,1.2), R, N(7,0.8), R, R, N(-5,1.0), R, R, N(0,1.2), R, R, N(3,0.8), R, R, N(-7,1.0), R],
        [N(0,1.0), N(6,0.8), R, N(11,1.0), R, R, N(4,0.8), R, N(0,1.0), R, N(9,0.8), R, R, N(2,1.0), R, R],
        [N(0,1.3), R, R, R, R, R, R, N(-5,0.8,True), N(0,1.3), R, R, R, R, R, R, N(7,0.8,True)],
        [N(0,1.0), N(0,0.8), N(0,0.6), R, R, R, R, R, N(7,1.0), N(7,0.8), N(7,0.6), R, R, R, R, R],
        [R, N(0,1.0), R, R, N(5,0.8), R, N(0,1.0), R, R, R, N(-3,0.8), R, N(0,1.0), R, R, N(7,0.8)],
        [N(0,1.2), R, N(-7,0.8), R, N(5,1.2), R, N(-3,0.8), R, N(7,1.2), R, N(-5,0.8), R, N(11,1.2), R, N(0,0.8), R],
        [N(0,1.0,True), R, R, R, R, N(6,0.8,True), R, R, R, R, N(-4,1.0,True), R, R, R, R, N(3,0.8,True)],
        [N(0,1.3), N(1,1.0), N(-1,1.0), N(2,0.8), N(-2,0.8), N(3,0.6), N(-3,0.6), R, R, R, R, R, R, R, R, R],
        [N(0,1.0), R, R, N(0,1.0), R, R, R, N(7,0.8), R, R, N(7,0.8), R, R, R, N(0,1.0), R],
        [R, R, R, R, N(0,1.2), R, R, R, R, R, R, R, N(-12,1.0), R, R, R],
    ],

    # ── EDM ──
    "edm": [
        # 1. 8th Pump — alternating accent 8ths
        [N(0,1.3), R, N(0,0.8), R, N(0,1.3), R, N(0,0.8), R, N(0,1.3), R, N(0,0.8), R, N(0,1.3), R, N(0,0.8), R],
        # 2. Power Stab — quarter-note power hits ascending
        [N(0,1.3), R, R, R, N(0,1.3), R, R, R, N(7,1.3), R, R, R, N(12,1.3), R, R, R],
        # 3. Rising Pump — dense 16th ascending intervals
        [N(0,1.3), N(0,0.8), N(0,1.3), N(0,0.8), N(5,1.3), N(5,0.8), N(5,1.3), N(5,0.8), N(7,1.3), N(7,0.8), N(7,1.3), N(7,0.8), N(12,1.3), N(12,0.8), N(12,1.3), N(12,0.8)],
        # 4. Offbeat Drive — offbeat root + fifth
        [R, N(0,1.3), R, N(0,0.8), R, N(0,1.3), R, N(0,0.8), R, N(7,1.3), R, N(7,0.8), R, N(7,1.3), R, N(7,0.8)],
        # 5. Syncopated Drop — dotted feel with interval jumps
        [N(0,1.3), R, R, N(0,0.5), R, N(0,1.3), R, R, N(5,1.3), R, R, N(5,0.5), R, N(7,1.3), R, R],
        # 6. Fifth Pump — root+fifth with syncopated gap
        [N(0,1.3), R, N(0,0.8), R, N(7,1.3), R, R, N(7,0.8), N(5,1.3), R, N(5,0.8), R, N(0,1.3), R, R, N(0,0.8)],
        # 7. Sub Hit — sparse half-note deep
        [N(0,1.3), R, R, R, R, R, R, R, N(0,1.3), R, R, R, R, R, R, R],
        # 8. Stutter Bass — triplet-feel stutter
        [N(0,1.3), N(0,0.5), R, N(0,1.3), N(0,0.5), R, N(0,1.3), N(0,0.5), R, N(0,1.3), N(0,0.5), R, N(0,1.3), N(0,0.5), R, R],
        # 9. Walking EDM — minor walk, grouped in 3s
        [N(0,1.3), N(3,0.8), N(5,1.3), R, N(7,0.8), N(5,1.3), N(3,0.8), R, N(0,1.3), N(-2,0.8), N(0,1.3), R, N(3,0.8), N(5,1.3), R, R],
        # 10. Octave Bounce — root-octave with rests
        [N(0,1.3), R, N(12,0.8), R, R, N(0,1.3), R, N(12,0.8), R, R, N(0,1.3), R, N(7,1.3), R, N(12,0.8), R],
    ],

    # ── DRUM-AND-BASS ──
    "drum-and-bass": [
        [N(0,1.3), R, N(0,1.0), R, N(0,1.3), R, N(0,1.0), N(0,0.8), N(0,1.3), R, N(0,1.0), R, N(0,1.3), R, N(0,1.0), N(0,0.8)],
        [N(-12,1.3), R, R, R, N(0,1.0), R, R, R, N(-12,1.3), R, R, R, N(0,1.0), R, N(-5,1.0,True), R],
        [N(0,1.3,True), N(-2,1.0,True), N(0,1.3), N(3,1.0,True), N(0,1.3,True), N(5,1.0,True), N(0,1.3), R, N(0,1.3,True), N(-2,1.0,True), N(0,1.3), N(7,1.0,True), N(5,1.0), R, N(0,1.3), R],
        [N(0,1.3), R, R, N(0,1.0), R, N(0,1.3), R, R, N(-5,1.3), R, R, N(-5,1.0), R, N(0,1.3), R, R],
        [N(0,1.2), R, N(0,0.8), R, N(5,1.2), R, N(5,0.8), R, N(7,1.2), R, N(7,0.8), R, N(5,1.2), R, N(0,0.8), R],
        [N(0,1.3), R, R, R, R, R, R, N(-5,1.0,True), N(0,1.3), R, R, R, R, R, R, N(3,1.0,True)],
        [N(0,1.3), N(0,1.0), N(0,1.3), N(0,1.0), N(0,1.3), N(0,1.0), N(0,1.3), N(0,1.0), N(-5,1.3), N(-5,1.0), N(-5,1.3), N(-5,1.0), N(0,1.3), N(0,1.0), N(0,1.3), N(0,1.0)],
        [N(0,1.3), R, N(3,1.0), R, N(5,1.3), R, N(3,1.0), R, N(0,1.3), R, N(-2,1.0), R, N(0,1.3), R, N(3,1.0), R],
        [N(0,1.3), R, R, R, R, R, R, R, N(0,1.3), R, R, R, R, R, N(-12,1.0), R],
        [N(0,1.3,True), R, N(5,1.0,True), R, N(0,1.3,True), R, N(7,1.0,True), R, N(5,1.3,True), R, N(3,1.0,True), R, N(0,1.3,True), R, N(-5,1.0,True), R],
    ],

    # ── HOUSE ──
    "house": [
        [R, N(0,1.2), R, N(0), R, N(0,1.2), R, N(0), R, N(0,1.2), R, N(0), R, N(0,1.2), R, N(0)],
        [N(0,1.2), R, R, R, N(0,1.0), R, R, R, N(0,1.2), R, R, R, N(7,1.0), R, R, R],
        [N(0,1.2), R, N(7,1.0), R, N(0,1.2), R, N(7,1.0), R, N(0,1.2), R, N(5,1.0), R, N(0,1.2), R, N(7,1.0), R],
        [N(0,1.3), R, R, N(0,0.8), R, R, N(0,1.3), R, R, N(0,0.8), R, R, N(0,1.3), R, R, N(0,0.8)],
        [N(0,1.2), R, N(0,0.8), R, N(0,1.2), R, N(0,0.8), R, N(5,1.2), R, N(5,0.8), R, N(7,1.2), R, N(7,0.8), R],
        [N(0,1.2), R, R, R, R, R, R, R, N(0,1.2), R, R, R, R, R, R, R],
        [N(0,1.3), N(0,0.7), N(0,1.3), N(0,0.7), N(0,1.3), N(0,0.7), N(0,1.3), N(0,0.7), N(5,1.3), N(5,0.7), N(5,1.3), N(5,0.7), N(7,1.3), N(7,0.7), N(7,1.3), N(7,0.7)],
        [N(0,1.0), R, R, N(0,0.8), R, N(7,1.0), R, R, N(0,1.0), R, R, N(5,0.8), R, N(0,1.0), R, R],
        [N(0,1.2), R, N(3,1.0), R, N(5,1.2), R, N(3,1.0), R, N(0,1.2), R, N(7,1.0), R, N(5,1.2), R, N(3,1.0), R],
        [R, N(0,1.0), R, R, N(0,1.0), R, R, N(0,1.0), R, R, N(7,1.0), R, R, N(7,1.0), R, R],
    ],

    # ── BREAKBEAT ──
    "breakbeat": [
        [N(0,1.2), R, N(0,0.8), N(3,1.0), R, N(5,1.2), R, N(3,0.8), R, N(0,1.2), N(3,0.8), R, N(5,1.0), R, N(0,1.2), R],
        [N(0,1.3), R, R, N(0,1.0), R, N(-5,1.3), R, R, N(0,1.3), R, R, N(3,1.0), R, N(-5,1.3), R, R],
        [N(0,1.2), R, N(0,0.7), R, N(3,1.2), R, N(0,0.7), R, N(5,1.2), R, N(3,0.7), R, N(0,1.2), R, N(-2,0.7), R],
        [N(0,1.0), R, R, R, N(0,0.8), R, R, R, N(-5,1.0), R, R, R, N(0,0.8), R, R, R],
        [N(0,1.3), N(0,0.8), R, N(0,1.3), N(3,0.8), R, N(5,1.3), R, N(0,1.3), N(0,0.8), R, N(7,1.3), N(5,0.8), R, N(3,1.3), R],
        [N(0,1.2), R, N(5,1.0), R, N(0,1.2), R, N(7,1.0), R, N(0,1.2), R, N(5,1.0), R, N(3,1.2), R, N(0,1.0), R],
        [N(0,1.0,True), R, N(3,1.0,True), R, N(5,1.0,True), R, N(3,1.0,True), R, N(0,1.0,True), R, N(-2,1.0,True), R, N(0,1.0,True), R, N(3,1.0,True), R],
        [N(0,1.3), R, R, R, R, R, R, N(-5,1.0), N(0,1.3), R, R, R, R, R, R, N(3,1.0)],
        [N(0,1.2), R, N(0,0.8), R, R, N(0,1.2), R, N(0,0.8), R, R, N(0,1.2), R, N(5,0.8), R, R, N(0,1.2)],
        [N(0,1.3), R, N(0,1.0), N(-2,1.0,True), R, N(0,1.3), R, N(3,1.0,True), N(0,1.3), R, N(5,1.0), N(3,1.0,True), R, N(0,1.3), R, N(-5,1.0,True)],
    ],

    # ── JUNGLE ──
    "jungle": [
        [N(-12,1.3), R, R, N(-12,1.0), R, N(-7,1.0,True), R, R, N(-12,1.3), R, R, N(-12,1.0), R, N(-5,1.0,True), R, R],
        [N(0,1.3), R, N(0,1.0), R, N(0,1.3), R, N(0,1.0), N(-5,0.8), N(0,1.3), R, N(0,1.0), R, N(0,1.3), R, N(-5,1.0), N(0,0.8)],
        [N(-12,1.3,True), N(-10,1.0,True), N(-12,1.3), R, N(-12,1.3,True), N(-7,1.0,True), N(-12,1.3), R, N(-12,1.3,True), N(-5,1.0,True), N(-12,1.3), R, N(-7,1.0,True), N(-12,1.3), R, R],
        [N(0,1.3), R, R, R, R, R, N(0,0.8), R, R, R, N(-5,1.3), R, R, R, N(0,0.8), R],
        [N(0,1.3), R, N(0,1.0), R, N(0,1.3), R, N(-5,1.0), R, N(0,1.3), R, N(0,1.0), R, N(-7,1.3), R, N(-5,1.0), R],
        [N(-12,1.3), R, R, R, R, R, R, R, N(-7,1.0,True), R, R, R, R, R, N(-12,1.0,True), R],
        [N(0,1.3), N(0,1.0), N(0,1.3), R, N(0,1.3), N(0,1.0), R, N(-5,1.3), N(0,1.3), N(0,1.0), N(0,1.3), R, N(-5,1.3), N(0,1.0), R, N(3,1.0,True)],
        [N(0,1.2), R, N(3,1.0,True), R, N(0,1.2), R, N(5,1.0,True), R, N(0,1.2), R, N(7,1.0,True), R, N(5,1.2), R, N(3,1.0,True), R],
        [N(-12,1.3), R, R, R, R, R, R, R, R, R, R, R, R, R, R, R],
        [N(0,1.3,True), R, N(-5,1.0,True), R, N(0,1.3,True), R, N(3,1.0,True), R, N(0,1.3,True), R, N(-7,1.0,True), R, N(0,1.3,True), R, N(-5,1.0,True), R],
    ],

    # ── GARAGE ──
    "garage": [
        [N(0,1.2), R, R, N(0,0.8), R, N(5,1.2), R, R, N(5,0.8), R, N(7,1.2), R, R, N(7,0.8), R, N(10,1.2)],
        [R, N(0,1.0), R, R, N(0,1.0), R, R, N(0,1.0), R, R, N(7,1.0), R, R, N(5,1.0), R, R],
        [N(0,1.3), R, N(0,0.7), R, N(3,1.3), R, R, N(5,0.7), N(7,1.3), R, N(5,0.7), R, N(3,1.3), R, R, N(0,0.7)],
        [N(0,1.2), R, R, R, R, R, N(7,0.8), R, R, R, N(0,1.2), R, R, R, R, R],
        [N(0,1.2), R, N(0,0.8), N(3,1.2), R, N(3,0.8), N(5,1.2), R, N(5,0.8), N(7,1.2), R, N(7,0.8), N(10,1.2), R, N(10,0.8), N(12,1.2)],
        [N(0,1.0), R, R, R, N(0,0.8), R, R, R, N(5,1.0), R, R, R, N(0,0.8), R, R, R],
        [N(0,1.3), N(0,0.8), R, N(3,1.3), N(0,0.8), R, N(5,1.3), N(0,0.8), R, N(7,1.3), N(5,0.8), R, N(3,1.3), N(0,0.8), R, R],
        [N(0,0.9), R, R, N(3,0.7), R, R, R, N(7,0.9), R, R, N(10,0.7), R, R, R, N(0,0.9), R],
        [R, N(0,1.0), R, N(0,0.8), R, N(5,1.0), R, N(5,0.8), R, N(7,1.0), R, N(7,0.8), R, N(10,1.0), R, N(10,0.8)],
        [N(0,1.2), R, R, R, N(5,1.0), R, R, R, N(7,1.2), R, R, R, N(5,1.0), R, R, R],
    ],

    # ── AMBIENT ──
    "ambient": [
        # 1. Sub Tide — deep root with gentle swell (differs from Long Drone: sub-octave, no slide, two hits)
        [N(-12,0.8), R, R, R, R, R, R, R, N(-12,0.6), R, R, R, R, R, R, R],
        # 2. Fifth Echo — root answered by distant fifth
        [N(0,0.7), R, R, R, R, R, R, R, R, R, N(7,0.5), R, R, R, R, R],
        # 3. Glacial Slide — long slide from root to fifth
        [N(0,0.7,True), R, R, R, R, R, R, R, R, R, R, R, N(7,0.6,True), R, R, R],
        # 4. Undertow — sub pulls then releases
        [N(-12,0.9), R, R, R, R, R, N(-7,0.7,True), R, R, R, R, R, R, R, R, R],
        # 5. Scattered — asymmetric gentle touches
        [R, R, R, N(0,0.6), R, R, R, R, R, R, R, R, R, N(-5,0.5), R, R],
        # 6. Octave Space — vast distance between low and high
        [N(-12,0.8), R, R, R, R, R, R, R, R, R, R, R, N(12,0.5), R, R, R],
        # 7. Descending — gentle chromatic down
        [N(5,0.7), R, R, R, N(4,0.6), R, R, R, N(3,0.6), R, R, R, N(2,0.5), R, R, R],
        # 8. Warm Pulse — two soft root hits, close together
        [N(0,0.7), N(0,0.5), R, R, R, R, R, R, R, R, R, R, R, R, R, R],
        # 9. Call and Wait — note at start, response near end
        [N(0,0.7), R, R, R, R, R, R, R, R, R, R, R, R, R, N(5,0.6), R],
        # 10. Deep Minimal — just one sub note, maximum space
        [N(-12,0.8), R, R, R, R, R, R, R, R, R, R, R, R, R, R, R],
    ],

    # ── GLITCH ──
    "glitch": [
        [N(0,1.3), N(0,0.5), R, R, R, R, R, R, N(7,1.3), N(7,0.5), R, R, R, R, R, R],
        [N(0,1.0), R, N(5,0.8), R, R, N(-3,1.2), R, R, N(7,1.0), R, R, R, N(-7,0.8), R, R, R],
        [N(0,1.3), N(0,1.2), N(0,1.1), N(0,1.0), N(0,0.9), N(0,0.8), N(0,0.7), N(0,0.6), R, R, R, R, R, R, R, R],
        [R, R, R, R, R, R, R, R, R, R, N(0,1.3), N(5,1.3), N(7,1.3), N(0,1.3), R, R],
        [N(0,1.0), N(1,0.8), N(-1,1.0), N(2,0.8), N(-2,1.0), R, R, R, R, R, R, N(0,1.0), N(1,0.8), N(-1,1.0), R, R],
        [N(0,1.0), R, R, N(0,1.0), R, R, R, R, N(0,1.0), R, N(0,1.0), R, R, R, R, R],
        [N(0,1.3), R, R, R, R, R, R, R, R, R, R, R, R, R, R, R],
        [N(0,0.6), N(0,0.7), N(0,0.8), N(0,0.9), N(0,1.0), N(0,1.1), N(0,1.2), N(0,1.3), N(0,1.3), N(0,1.2), N(0,1.1), N(0,1.0), N(0,0.9), N(0,0.8), N(0,0.7), N(0,0.6)],
        [R, N(0,1.2), R, R, R, R, N(7,1.2), R, R, R, R, R, R, N(-5,1.2), R, R],
        [N(0,1.3), N(0,0.5), N(0,1.3), N(0,0.5), R, R, R, R, R, R, R, R, N(7,1.3), N(7,0.5), R, R],
    ],

    # ── ELECTRO ──
    "electro": [
        # 1. Stepping — 8th root with b7 movement
        [N(0,1.3), R, N(0,0.8), R, N(0,1.3), R, N(0,0.8), R, N(-5,1.3), R, N(-5,0.8), R, N(0,1.3), R, N(0,0.8), R],
        # 2. 808 Boom — sparse deep sub hits
        [N(-12,1.3), R, R, R, N(-12,0.8), R, R, R, N(-12,1.3), R, R, N(-7,1.0), R, R, N(-12,1.3), R],
        # 3. Doubled Walk — paired ascending, dotted feel
        [N(0,1.2), N(0,0.8), R, N(3,1.2), N(3,0.8), R, N(5,1.2), N(5,0.8), R, N(7,1.2), N(7,0.8), R, R, R, R, R],
        # 4. Power Pump — dense 16th with accent pulse
        [N(0,1.3), N(0,0.5), N(0,1.3), N(0,0.5), N(0,1.3), N(0,0.5), N(0,1.3), N(0,0.5), N(0,1.3), N(0,0.5), N(0,1.3), N(0,0.5), N(0,1.3), N(0,0.5), N(0,1.3), N(0,0.5)],
        # 5. Fifth Bounce — root-5th with syncopation
        [N(0,1.3), R, N(7,0.8), R, N(0,1.3), R, R, N(7,0.8), N(0,1.3), R, N(12,1.0), R, R, N(7,1.3), R, N(0,0.8)],
        # 6. B-Boy Bass — syncopated sparse
        [N(0,1.3), R, R, N(0,0.8), R, N(0,1.3), R, R, N(-5,1.3), R, R, N(-5,0.8), R, N(0,1.3), R, R],
        # 7. Slide Machine — sliding scale, grouped 3s
        [N(0,1.2,True), N(3,1.0,True), N(5,1.2,True), R, N(7,1.0,True), N(5,1.2,True), N(3,1.0,True), R, N(0,1.2,True), N(-2,1.0,True), N(0,1.2,True), R, R, R, R, R],
        # 8. Sub Pulse — half-note deep hits
        [N(0,1.3), R, R, R, R, R, R, R, N(0,1.3), R, R, R, R, R, R, R],
        # 9. Offbeat Robot — offbeat root-5th
        [R, N(0,1.2), R, N(0,0.8), R, N(0,1.2), R, N(0,0.8), R, N(7,1.2), R, N(7,0.8), R, N(7,1.2), R, N(7,0.8)],
        # 10. Octave Drop — root-sub with rest gap
        [N(0,1.3), R, N(-12,0.8), R, R, N(0,1.3), R, N(-12,0.8), R, R, N(0,1.3), R, N(-7,1.3), R, N(-12,0.8), R],
    ],

    # ── DOWNTEMPO ──
    "downtempo": [
        [N(0,1.0), R, R, R, N(0,0.8), R, R, R, N(-5,1.0), R, R, R, N(0,0.8), R, R, R],
        [N(0,0.9), R, R, R, R, R, R, R, N(5,0.7), R, R, R, R, R, R, R],
        [N(0,1.0), R, N(3,0.8), R, N(5,1.0), R, N(3,0.8), R, N(0,1.0), R, N(-2,0.8), R, N(0,1.0), R, R, R],
        [N(0,1.0,True), R, R, R, N(5,0.8,True), R, R, R, N(7,1.0,True), R, R, R, N(5,0.8,True), R, R, R],
        [N(0,1.2), R, R, N(0,0.7), R, N(-5,1.2), R, R, N(0,1.2), R, R, N(3,0.7), R, N(-5,1.2), R, R],
        [N(0,0.9), R, R, R, R, R, R, R, R, R, R, R, R, R, R, R],
        [N(0,1.0), R, R, R, N(7,0.8), R, R, R, N(5,1.0), R, R, R, N(3,0.8), R, R, R],
        [R, R, N(0,0.9), R, R, R, R, N(5,0.7), R, R, N(0,0.9), R, R, R, R, N(-2,0.7)],
        [N(0,1.0), R, N(0,0.8), R, R, N(0,1.0), R, N(0,0.8), R, R, N(0,1.0), R, N(0,0.8), R, R, R],
        [N(0,1.0,True), R, R, R, R, R, N(7,0.8,True), R, R, R, R, R, N(0,1.0,True), R, R, R],
    ],
}


# ─── CATALOG NAMES & DESCRIPTIONS ────────────────────────

CATALOG_NAMES = {
    "techno": {
        "s1": [
            {"name": "Siren Cycle", "desc": "Rising minor scale loop \u2014 alarm-like intensity"},
            {"name": "Piston", "desc": "Accented root with ghost notes \u2014 pneumatic pressure"},
            {"name": "Flatline", "desc": "Sparse root stabs on downbeats \u2014 clinical and cold"},
            {"name": "Minor Triad Lock", "desc": "Cycling root\u2013b3\u20135 \u2014 locked-in harmonic motion"},
            {"name": "Sub Drop", "desc": "Low octave pulse with occasional rise \u2014 subterranean weight"},
            {"name": "Ascender", "desc": "Chromatic rise across the bar \u2014 escalating tension"},
            {"name": "Call-Answer", "desc": "Two-beat phrase with variation \u2014 conversational groove"},
            {"name": "Velocity Pump", "desc": "Same pitch, dynamic contrast \u2014 breathing intensity"},
            {"name": "Warehouse Stab", "desc": "Sparse syncopated minor \u2014 dark space energy"},
            {"name": "Hypnotic Fifth", "desc": "Root and fifth with slides \u2014 meditative power"},
        ],
        "drums": [
            {"name": "Berlin Minimal", "desc": "Kick and sparse hats \u2014 stripped to essentials"},
            {"name": "Industrial Pound", "desc": "Heavy doubled kick pattern \u2014 relentless pressure"},
            {"name": "Hat Dance", "desc": "16th hi-hat focus with ghost dynamics \u2014 hypnotic shimmer"},
            {"name": "Ride Techno", "desc": "Ride cymbal driven groove \u2014 metallic and flowing"},
            {"name": "Stripped", "desc": "Kick and clap only \u2014 maximum minimalism"},
            {"name": "Syncopated Kick", "desc": "Off-grid kicks \u2014 unexpected pulse shifts"},
            {"name": "Percussion Layer", "desc": "Cowbell and rimshot texture \u2014 layered detail"},
            {"name": "Half-Time Feel", "desc": "Slow heavy groove \u2014 lumbering weight"},
            {"name": "Double Kick", "desc": "Kick on every 8th \u2014 propulsive drive"},
            {"name": "Warehouse Stomp", "desc": "Raw and driving \u2014 open hat energy"},
        ],
        "bass": [
            {"name": "Chromatic Return", "desc": "Root pulse with chromatic passing tone \u2014 tension and release"},
            {"name": "Quarter Pound", "desc": "Quarter-note root hits \u2014 heavy and deliberate"},
            {"name": "Ghost Pump", "desc": "16th root with ghost velocity \u2014 breathing sub"},
            {"name": "Octave Drop", "desc": "Root and sub-octave alternating \u2014 depth charge"},
            {"name": "Open Fifth", "desc": "Root\u20135th alternating \u2014 wide harmonic motion"},
            {"name": "Dotted Pulse", "desc": "Dotted rhythm on root \u2014 off-kilter momentum"},
            {"name": "Minor Walk", "desc": "Stepping root\u2013b7 bass \u2014 dark progression"},
            {"name": "Sub Heartbeat", "desc": "Half-note root pulse \u2014 deep and patient"},
            {"name": "Triad Walk", "desc": "Root\u2013b3\u20135\u20137 movement \u2014 harmonic exploration"},
            {"name": "Sliding Octave", "desc": "Root\u2013octave with slides \u2014 elastic low end"},
        ],
    },

    "acid-techno": {
        "s1": [
            {"name": "Squelch Staircase", "desc": "Ascending slides and accents \u2014 filter ladder climb"},
            {"name": "Elastic Snap", "desc": "Octave bounce with chromatic passing \u2014 elastic squelch"},
            {"name": "Acid Rain", "desc": "Dense 16th with heavy slides \u2014 relentless downpour"},
            {"name": "Screamer", "desc": "High register acid shrieks \u2014 piercing resonance"},
            {"name": "Sub Acid", "desc": "Deep register with octave stabs \u2014 subterranean gurgle"},
            {"name": "Wobble Lock", "desc": "Alternating accent/slide on 2 notes \u2014 hypnotic wobble"},
            {"name": "Chromatic Spiral", "desc": "Descending chromatic with slides \u2014 dizzying descent"},
            {"name": "TAoW Classic", "desc": "Accent+slide octave drop \u2014 the iconic 303 sound"},
            {"name": "Phuture Bounce", "desc": "Minimal acid with minor 3rd \u2014 Chicago heritage"},
            {"name": "Resonance Peak", "desc": "Accented root bursts with filter sweep \u2014 peak energy"},
        ],
        "drums": [
            {"name": "909 Acid", "desc": "Classic 909 with open hats \u2014 definitive acid beat"},
            {"name": "Hypnotic Acid", "desc": "Minimal kick + open hat \u2014 trance-inducing pulse"},
            {"name": "Acid Frenzy", "desc": "Dense 16th hats \u2014 maximum energy"},
            {"name": "Clap Drive", "desc": "Double clap pattern \u2014 percussive intensity"},
            {"name": "Kick Roll", "desc": "Rapid kick pattern \u2014 rolling thunder"},
            {"name": "Tribal Acid", "desc": "Percussion heavy with cowbell \u2014 primal energy"},
            {"name": "Distorted", "desc": "Heavy accent pattern \u2014 overdriven intensity"},
            {"name": "Open Hat Groove", "desc": "OH on offbeats \u2014 breathing space"},
            {"name": "Galloping", "desc": "Triplet-like feel \u2014 horse-ride momentum"},
            {"name": "Acid Warehouse", "desc": "Raw and loud \u2014 uncompromising energy"},
        ],
        "bass": [
            {"name": "Octave Bounce", "desc": "Root\u2013octave with slides \u2014 elastic acid bass"},
            {"name": "Acid Arp", "desc": "Sliding minor arpeggio \u2014 303 classic movement"},
            {"name": "Approach Tone", "desc": "Chromatic approach notes \u2014 slithering resolution"},
            {"name": "Sub Stab", "desc": "Sub octave with upper slides \u2014 deep and reaching"},
            {"name": "Pulse Squeal", "desc": "Root pump with octave accents \u2014 resonance workout"},
            {"name": "Slide Fifth", "desc": "Root and fifth with slides \u2014 wide acid motion"},
            {"name": "Chromatic Wobble", "desc": "Chromatic passing tones off root \u2014 unstable wobble"},
            {"name": "Deep Stab", "desc": "Sparse root with distant octave \u2014 deep space acid"},
            {"name": "Minor Crawl", "desc": "Sliding minor walk \u2014 dark acid creep"},
            {"name": "Burst Pattern", "desc": "Accented root bursts with slides \u2014 explosive energy"},
        ],
    },

    "trance": {
        "s1": [
            {"name": "Uplift Arp", "desc": "Ascending minor arpeggio \u2014 soaring energy"},
            {"name": "Gate Pulse", "desc": "Gated pad rhythm \u2014 pulsating atmosphere"},
            {"name": "Anthem Lead", "desc": "Bold melodic phrase \u2014 festival-ready hook"},
            {"name": "Rolling Offbeat", "desc": "Offbeat synth stabs \u2014 hypnotic drive"},
            {"name": "Ethereal Sparse", "desc": "Wide intervals, vast space \u2014 celestial calm"},
            {"name": "Descending Cascade", "desc": "Falling arpeggio \u2014 waterfall of notes"},
            {"name": "Trance Stab", "desc": "Rhythmic chord stab \u2014 classic trance energy"},
            {"name": "Supersaw Ride", "desc": "Dense 16th drive \u2014 wall of sound"},
            {"name": "Pluck Sequence", "desc": "Transposing 4-note motif \u2014 evolving melody"},
            {"name": "Breakdown Melody", "desc": "Emotional wide phrasing \u2014 breakdown moment"},
        ],
        "drums": [
            {"name": "Ibiza Drive", "desc": "Classic 4/4 with offbeat OH \u2014 pure trance drive"},
            {"name": "Driving", "desc": "Heavy kick emphasis \u2014 relentless forward motion"},
            {"name": "Breakdown", "desc": "Sparse and building \u2014 tension before the drop"},
            {"name": "Uplifting", "desc": "Ride + clap energy \u2014 euphoric momentum"},
            {"name": "Goa", "desc": "Busier with percussion \u2014 psychedelic groove"},
            {"name": "Psy", "desc": "Rapid hi-hat \u2014 16th-note trance drive"},
            {"name": "Rolling", "desc": "Continuous energy \u2014 non-stop motion"},
            {"name": "Soft", "desc": "Delicate and gentle \u2014 atmospheric touch"},
            {"name": "Hard Trance", "desc": "Aggressive doubled kicks \u2014 peak-time energy"},
            {"name": "Snare Riser", "desc": "Snare roll crescendo \u2014 building to the drop"},
        ],
        "bass": [
            {"name": "Offbeat Pump", "desc": "Offbeat root pulse \u2014 classic trance bass"},
            {"name": "Fifth Bounce", "desc": "Root\u20135th alternating \u2014 wide harmonic motion"},
            {"name": "Quarter Root", "desc": "Quarter-note root \u2014 simple and solid"},
            {"name": "Gallop", "desc": "Triple-feel root \u2014 galloping energy"},
            {"name": "Dynamic Pump", "desc": "Accented alternating \u2014 breathing bass"},
            {"name": "Slide Root", "desc": "Sliding root + fifth \u2014 legato low end"},
            {"name": "Offbeat Fifth", "desc": "Offbeat root\u20135th \u2014 flowing motion"},
            {"name": "Stutter Pump", "desc": "Root with stutter \u2014 rhythmic detail"},
            {"name": "Walking Trance", "desc": "Minor scale walk \u2014 melodic bass"},
            {"name": "Dotted Root", "desc": "Dotted rhythm root \u2014 off-kilter groove"},
        ],
    },

    "dub-techno": {
        "s1": [
            {"name": "Deep Chord", "desc": "Sparse sustained chord \u2014 infinite reverb"},
            {"name": "Echo Stab", "desc": "Stab with delay decay \u2014 fading repetition"},
            {"name": "Underwater Drift", "desc": "Slow movement, minor 7th \u2014 submerged color"},
            {"name": "Foghorn", "desc": "Deep root drone with rare movement \u2014 distant warning"},
            {"name": "Haze", "desc": "Two notes drifting \u2014 blurred edges"},
            {"name": "Chain Delay", "desc": "Rhythmic echo pattern \u2014 cascading repeats"},
            {"name": "Submerged", "desc": "Ultra-deep single note \u2014 ocean floor"},
            {"name": "Berlin Night", "desc": "Root + minor third \u2014 cold city atmosphere"},
            {"name": "Depth Charge", "desc": "Sporadic deep hits \u2014 explosive and rare"},
            {"name": "Reef", "desc": "Gentle sliding movement \u2014 organic flow"},
        ],
        "drums": [
            {"name": "Basic Channel", "desc": "Ultra-minimal kick and snare \u2014 essential only"},
            {"name": "Hazy", "desc": "Sparse with rimshot \u2014 foggy texture"},
            {"name": "Echo Chamber", "desc": "Delayed percussion feel \u2014 spacious reverb"},
            {"name": "Submerged", "desc": "Deep kick only \u2014 heartbeat of the deep"},
            {"name": "Mist", "desc": "Gentle shaker-like hats \u2014 atmospheric veil"},
            {"name": "Chain", "desc": "Sparse kick + delayed snare \u2014 slow echo"},
            {"name": "Fog", "desc": "Ride cymbal drift \u2014 metallic mist"},
            {"name": "Depth", "desc": "Kick and open hat only \u2014 minimal depth"},
            {"name": "Tape Hiss", "desc": "Ultra-sparse texture \u2014 barely there"},
            {"name": "Detroit Dub", "desc": "Slightly more active \u2014 Motor City depth"},
        ],
        "bass": [
            {"name": "Heartbeat", "desc": "Half-note root pulse \u2014 deep and patient"},
            {"name": "Single Tone", "desc": "One root note per bar \u2014 absolute minimal"},
            {"name": "Slide Fifth", "desc": "Root with sliding fifth \u2014 gentle harmonic motion"},
            {"name": "Sub Drift", "desc": "Root with sub shift \u2014 low-end movement"},
            {"name": "Tape Delay", "desc": "Root with fading repeats \u2014 delay-like decay"},
            {"name": "Offbeat Root", "desc": "Offbeat placement \u2014 dub-style emphasis"},
            {"name": "Deep Sub", "desc": "Sub-octave root only \u2014 felt not heard"},
            {"name": "Fifth Drift", "desc": "Root to fifth movement \u2014 wide and slow"},
            {"name": "Quarter Pulse", "desc": "Gentle quarter-note root \u2014 steady pulse"},
            {"name": "Minor Slide", "desc": "Root with minor third slide \u2014 melancholic depth"},
        ],
    },

    "idm": {
        "s1": [
            {"name": "Fractal", "desc": "Irregular intervals, shifting accents \u2014 self-similar chaos"},
            {"name": "Clockwork", "desc": "Precise mechanical pattern \u2014 odd-interval gears"},
            {"name": "Warp Glide", "desc": "Sliding between distant notes \u2014 pitch-space travel"},
            {"name": "Scatter", "desc": "Unpredictable density \u2014 scattered intelligence"},
            {"name": "Microloop", "desc": "Tiny motif repeating \u2014 obsessive detail"},
            {"name": "Detune", "desc": "Chromatic cluster \u2014 unstable frequency"},
            {"name": "Phase Drift", "desc": "Two implied rhythmic layers \u2014 phasing perception"},
            {"name": "Granular Burst", "desc": "Dense cluster then silence \u2014 particle explosion"},
            {"name": "Algorithm", "desc": "Mathematically spaced intervals \u2014 computed melody"},
            {"name": "Organic Drift", "desc": "Slow evolving phrase \u2014 digital nature"},
        ],
        "drums": [
            {"name": "Broken Grid", "desc": "Irregular kick placement \u2014 fractured pulse"},
            {"name": "Scatter", "desc": "Unpredictable hits \u2014 algorithmic chaos"},
            {"name": "Micro Beats", "desc": "Rapid tiny hits \u2014 granular percussion"},
            {"name": "Drill Pattern", "desc": "Rapid snare bursts \u2014 machine-gun stutters"},
            {"name": "Polyrhythm", "desc": "Overlapping cycles \u2014 mathematical rhythm"},
            {"name": "Generative", "desc": "Seemingly random \u2014 emergent pattern"},
            {"name": "Glitch Beat", "desc": "Stuttering hits \u2014 digital artifact rhythm"},
            {"name": "Ambient Percussion", "desc": "Gentle texture \u2014 barely percussive"},
            {"name": "Asymmetric", "desc": "Odd grouping feel \u2014 uneven meter"},
            {"name": "Warp", "desc": "Complex evolving \u2014 time-stretched beat"},
        ],
        "bass": [
            {"name": "Erratic Walk", "desc": "Irregular intervals and rests \u2014 wandering bass"},
            {"name": "Tritone Lock", "desc": "Tritone and scale movement \u2014 dissonant anchor"},
            {"name": "Slow Morph", "desc": "Sparse with slides \u2014 glacial bass shift"},
            {"name": "Stutter Echo", "desc": "Decaying repeats \u2014 granular bass"},
            {"name": "Displaced", "desc": "Off-grid rhythm \u2014 temporal drift"},
            {"name": "Wide Interval", "desc": "Large leaps between notes \u2014 disjunct motion"},
            {"name": "Slide Drift", "desc": "Long slides between distant notes \u2014 pitch bend journey"},
            {"name": "Micro Burst", "desc": "Chromatic cluster burst \u2014 particle shower"},
            {"name": "Sparse Grid", "desc": "Few notes, odd spacing \u2014 negative space"},
            {"name": "Deep Absence", "desc": "Rare deep hits \u2014 silence as structure"},
        ],
    },

    "edm": {
        "s1": [
            {"name": "Festival Anthem", "desc": "Bold arpeggio \u2014 hands-in-the-air moment"},
            {"name": "Drop Hammer", "desc": "Heavy root pump \u2014 maximum impact"},
            {"name": "Build Riser", "desc": "Ascending scale momentum \u2014 pre-drop tension"},
            {"name": "Pluck Lead", "desc": "Melodic pluck sequence \u2014 catchy and bright"},
            {"name": "Big Room Stab", "desc": "Sparse power stabs \u2014 massive and bold"},
            {"name": "Sidechain Pulse", "desc": "Pumping rhythm \u2014 ducking groove"},
            {"name": "Tropical Arp", "desc": "Major-feel bounce \u2014 sunny vibes"},
            {"name": "Electro House Riff", "desc": "Driving repeated riff \u2014 dancefloor fuel"},
            {"name": "Wobble Bass Lead", "desc": "Alternating octave wobble \u2014 dubstep crossover"},
            {"name": "Mainstage", "desc": "Climactic big melody \u2014 peak-time anthem"},
        ],
        "drums": [
            {"name": "Festival", "desc": "Big room beat \u2014 massive 4/4 energy"},
            {"name": "Drop Beat", "desc": "Heavy doubled kick \u2014 impact groove"},
            {"name": "Buildup", "desc": "Snare fill crescendo \u2014 pre-drop tension"},
            {"name": "Bounce", "desc": "Offbeat kick groove \u2014 bouncy energy"},
            {"name": "Tropical", "desc": "Lighter shuffle \u2014 summer vibes"},
            {"name": "Stomper", "desc": "Four-on-floor heavy \u2014 maximum stomp"},
            {"name": "Future Bass", "desc": "Syncopated groove \u2014 modern feel"},
            {"name": "Clap Attack", "desc": "Clap-heavy groove \u2014 driving energy"},
            {"name": "Progressive", "desc": "Smooth build \u2014 gradual intensity"},
            {"name": "Mainstage Drop", "desc": "Maximum energy \u2014 peak-time beat"},
        ],
        "bass": [
            {"name": "8th Pump", "desc": "8th-note root pump \u2014 constant drive"},
            {"name": "Power Stab", "desc": "Quarter-note power hits \u2014 impact bass"},
            {"name": "Rising Pump", "desc": "Ascending root pump \u2014 building energy"},
            {"name": "Offbeat Drive", "desc": "Offbeat root \u2014 pumping groove"},
            {"name": "Syncopated Drop", "desc": "Accented syncopated bass \u2014 groove detail"},
            {"name": "Fifth Pump", "desc": "Root\u20135th alternating \u2014 wide and powerful"},
            {"name": "Sub Hit", "desc": "Half-note sub bass \u2014 deep impact"},
            {"name": "Stutter Bass", "desc": "Stuttered root rhythm \u2014 rhythmic detail"},
            {"name": "Walking EDM", "desc": "Minor scale walk \u2014 melodic bass"},
            {"name": "Octave Bounce", "desc": "Root\u2013octave alternating \u2014 bouncing energy"},
        ],
    },

    "drum-and-bass": {
        "s1": [
            {"name": "Neuro Riff", "desc": "Aggressive bass movement \u2014 neurofunk snarl"},
            {"name": "Liquid Melody", "desc": "Smooth flowing line \u2014 liquid DnB soul"},
            {"name": "Sub Roller", "desc": "Deep rolling sub \u2014 floor-shaking weight"},
            {"name": "Launch Pad", "desc": "Bouncy energetic \u2014 dancefloor launcher"},
            {"name": "Reese Growl", "desc": "Dark sliding bass \u2014 detuned menace"},
            {"name": "Steppy", "desc": "Choppy staccato hits \u2014 clean and precise"},
            {"name": "Halftime", "desc": "Slower feel, heavy \u2014 half-speed weight"},
            {"name": "Amen Bassline", "desc": "Following the break rhythm \u2014 locked to the amen"},
            {"name": "Tearout", "desc": "Aggressive dense \u2014 maximum aggression"},
            {"name": "Dancefloor", "desc": "Classic DnB melodic bass \u2014 crowd mover"},
        ],
        "drums": [
            {"name": "Two-Step", "desc": "Classic DnB two-step \u2014 foundational groove"},
            {"name": "Roller", "desc": "Fast rolling hats \u2014 relentless forward motion"},
            {"name": "Jungle Crossover", "desc": "Amen-style break \u2014 heritage rhythm"},
            {"name": "Liquid", "desc": "Smooth flowing groove \u2014 soulful DnB"},
            {"name": "Neuro", "desc": "Aggressive doubled kicks \u2014 neurofunk drive"},
            {"name": "Half-Time", "desc": "Slower feel groove \u2014 heavy and deliberate"},
            {"name": "Syncopated", "desc": "Offbeat snares \u2014 displaced groove"},
            {"name": "Minimal DnB", "desc": "Stripped back \u2014 space and impact"},
            {"name": "Jump Up", "desc": "Energetic groove \u2014 dancefloor launcher"},
            {"name": "Drumfunk", "desc": "Complex breakbeat \u2014 intricate percussion"},
        ],
        "bass": [
            {"name": "Rolling 8th", "desc": "8th-note root roll \u2014 classic DnB drive"},
            {"name": "Sub Octave", "desc": "Root and sub alternating \u2014 deep weight"},
            {"name": "Reese Line", "desc": "Sliding growl bass \u2014 detuned menace"},
            {"name": "Syncopated Sub", "desc": "Offbeat emphasis \u2014 groove-locked sub"},
            {"name": "Steppy Bass", "desc": "Stepping through intervals \u2014 clean movement"},
            {"name": "Halftime Sub", "desc": "Sparse deep hits \u2014 half-speed impact"},
            {"name": "16th Roll", "desc": "Dense 16th-note drive \u2014 relentless rolling"},
            {"name": "Melodic Walk", "desc": "Minor scale walk \u2014 soulful bass"},
            {"name": "Deep Minimal", "desc": "Sparse sub hits \u2014 space and weight"},
            {"name": "Sliding Fifth", "desc": "Root\u20135th with slides \u2014 liquid bass motion"},
        ],
    },

    "house": {
        "s1": [
            {"name": "Disco Chop", "desc": "Funky chopped rhythm \u2014 disco DNA"},
            {"name": "Piano Stab", "desc": "Classic house piano hit \u2014 Chicago soul"},
            {"name": "Organ Groove", "desc": "Soulful organ riff \u2014 gospel-house warmth"},
            {"name": "Deep Minimal", "desc": "Ultra-sparse deep house \u2014 less is more"},
            {"name": "Groove Bounce", "desc": "Swinging offbeat \u2014 head-nodding groove"},
            {"name": "Jacking", "desc": "Fast rhythmic pulse \u2014 jacking house energy"},
            {"name": "Filtered", "desc": "Sparse accent variation \u2014 filter-swept feel"},
            {"name": "Chicago Classic", "desc": "Root and fifth bounce \u2014 Windy City heritage"},
            {"name": "Vocal Chop Rhythm", "desc": "Choppy vocal-style rhythm \u2014 diva house groove"},
            {"name": "Sunset Drive", "desc": "Melodic deep house \u2014 golden-hour vibes"},
        ],
        "drums": [
            {"name": "Classic", "desc": "4/4 + offbeat OH \u2014 essential house groove"},
            {"name": "Deep", "desc": "Minimal kick + clap \u2014 deep house foundation"},
            {"name": "Disco", "desc": "Busier funky groove \u2014 disco-house energy"},
            {"name": "Garage-Tinged", "desc": "Skippy kick pattern \u2014 garage influence"},
            {"name": "Percussion", "desc": "Shakers and rimshots \u2014 layered texture"},
            {"name": "Chi-Town Acid", "desc": "909 meets 303 \u2014 Chicago acid groove"},
            {"name": "Warehouse Tech", "desc": "Driving beat \u2014 techno-house crossover"},
            {"name": "Stripped", "desc": "Ultra-minimal groove \u2014 essential elements"},
            {"name": "Jackin", "desc": "Fast and raw \u2014 warehouse energy"},
            {"name": "Afro House", "desc": "Percussion-rich \u2014 African rhythm influence"},
        ],
        "bass": [
            {"name": "Offbeat Classic", "desc": "Offbeat root pump \u2014 classic house bass"},
            {"name": "Quarter Pulse", "desc": "Quarter-note root \u2014 simple and solid"},
            {"name": "Fifth Walk", "desc": "Root\u20135th alternating \u2014 harmonic motion"},
            {"name": "Dotted Root", "desc": "Dotted rhythm root \u2014 groovy feel"},
            {"name": "Dynamic Walk", "desc": "Root walk with accents \u2014 breathing bass"},
            {"name": "Deep Sub", "desc": "Half-note root \u2014 deep and patient"},
            {"name": "Jacking Bass", "desc": "16th-note groove \u2014 jacking energy"},
            {"name": "Syncopated", "desc": "Offbeat accented bass \u2014 groove detail"},
            {"name": "Melodic Walk", "desc": "Minor scale walk \u2014 soulful movement"},
            {"name": "Bouncing", "desc": "Skippy offbeat rhythm \u2014 bouncing groove"},
        ],
    },

    "breakbeat": {
        "s1": [
            {"name": "Funky Breaks", "desc": "Syncopated funk groove \u2014 get-up-and-dance energy"},
            {"name": "Big Beat Riff", "desc": "Chemical Brothers style \u2014 festival-ready riff"},
            {"name": "Prodigy Stab", "desc": "Aggressive stab pattern \u2014 rave-ready energy"},
            {"name": "Dusty Groove", "desc": "Laid-back breakbeat \u2014 crate-digger vibes"},
            {"name": "Acid Break", "desc": "Breakbeat meets acid \u2014 squelchy breaks"},
            {"name": "Nu Skool", "desc": "Modern breakbeat \u2014 updated energy"},
            {"name": "B-Boy", "desc": "Hip-hop influenced \u2014 street-level groove"},
            {"name": "Filtered Break", "desc": "Dynamic velocity sweep \u2014 filter-like motion"},
            {"name": "Scratch Hook", "desc": "Scratch-like pattern \u2014 turntablist energy"},
            {"name": "Warehouse Rave", "desc": "Old-school rave breaks \u2014 early 90s energy"},
        ],
        "drums": [
            {"name": "Funk Chop", "desc": "Syncopated kick groove \u2014 funk-rooted rhythm"},
            {"name": "Brighton Stomp", "desc": "Heavy break \u2014 Fatboy Slim energy"},
            {"name": "Nu Skool", "desc": "Modern breaks groove \u2014 updated feel"},
            {"name": "Dusty", "desc": "Lo-fi feel groove \u2014 vinyl warmth"},
            {"name": "Rave", "desc": "Old-school rave breaks \u2014 92 energy"},
            {"name": "Percussion", "desc": "Cowbell and rimshot \u2014 layered texture"},
            {"name": "Half-Time", "desc": "Slower feel groove \u2014 deliberate weight"},
            {"name": "Choppy", "desc": "Rapid fire hits \u2014 sliced and diced"},
            {"name": "Filtered", "desc": "Dynamic velocity sweep \u2014 opening and closing"},
            {"name": "Warehouse", "desc": "Raw energy groove \u2014 open hat drive"},
        ],
        "bass": [
            {"name": "Funky Walk", "desc": "Syncopated funky bass \u2014 groove-locked"},
            {"name": "B-Boy Sub", "desc": "Hip-hop style bass \u2014 head-nodding weight"},
            {"name": "Stepping", "desc": "Clean interval walk \u2014 precise movement"},
            {"name": "Sparse Groove", "desc": "Quarter-note sparse \u2014 breathing space"},
            {"name": "Choppy Funk", "desc": "Dense syncopated \u2014 funky energy"},
            {"name": "Fifth Walk", "desc": "Root\u20135th movement \u2014 wide and groovy"},
            {"name": "Slide Funk", "desc": "Sliding chromatic \u2014 slippery groove"},
            {"name": "Halftime Sub", "desc": "Sparse deep hits \u2014 heavy and slow"},
            {"name": "Skippy", "desc": "Offbeat skip pattern \u2014 bouncing breaks"},
            {"name": "Acid Breaks Bass", "desc": "Chromatic slides with breaks \u2014 squelchy groove"},
        ],
    },

    "jungle": {
        "s1": [
            {"name": "Ragga Bass", "desc": "Reggae-influenced bass \u2014 sound system pressure"},
            {"name": "Dark Roller", "desc": "Menacing rolling line \u2014 shadowy movement"},
            {"name": "Stepper", "desc": "Steady stepping bass \u2014 locked-in groove"},
            {"name": "Dread Bass", "desc": "Deep dub influence \u2014 heavy meditation"},
            {"name": "Choppy Stabs", "desc": "Rapid fire stabs \u2014 jungle fury"},
            {"name": "Amen Lead", "desc": "Melodic line riding the break \u2014 uplifting jungle"},
            {"name": "Sub Pressure", "desc": "Ultra-deep sub with accents \u2014 speaker-shaking weight"},
            {"name": "Rewind", "desc": "Building urgency \u2014 pull-up energy"},
            {"name": "Roots", "desc": "Rootsy reggae bass \u2014 yard vibes"},
            {"name": "Rinse Out", "desc": "Fast aggressive bass \u2014 dancefloor destroyer"},
        ],
        "drums": [
            {"name": "Amen Classic", "desc": "Classic amen break pattern \u2014 the original jungle beat"},
            {"name": "Chopped", "desc": "Sliced break \u2014 razor-edited rhythm"},
            {"name": "Ragga", "desc": "Reggae-influenced rhythm \u2014 dancehall groove"},
            {"name": "Dark", "desc": "Menacing groove \u2014 shadowy breaks"},
            {"name": "Roller", "desc": "Fast rolling break \u2014 relentless energy"},
            {"name": "Steppers", "desc": "Steady stepping rhythm \u2014 locked groove"},
            {"name": "Apache", "desc": "Apache break style \u2014 classic sample rhythm"},
            {"name": "Ghost", "desc": "Ghost note heavy \u2014 intricate texture"},
            {"name": "Rewind", "desc": "Building intensity \u2014 pre-rewind tension"},
            {"name": "Think Break", "desc": "Classic break pattern \u2014 old-school foundation"},
        ],
        "bass": [
            {"name": "Dread Sub", "desc": "Deep sub with slides \u2014 dub weight"},
            {"name": "Stepper Bass", "desc": "Steady 8th-note roll \u2014 locked groove"},
            {"name": "Dark Crawler", "desc": "Sliding chromatic sub \u2014 menacing motion"},
            {"name": "Roots Dub", "desc": "Sparse rootsy bass \u2014 sound system vibes"},
            {"name": "Stepping Fifth", "desc": "Root\u20135th stepping \u2014 melodic sub"},
            {"name": "Deep Drone", "desc": "Single sub note \u2014 sustained pressure"},
            {"name": "Choppy Sub", "desc": "Dense chopped bass \u2014 jungle fury"},
            {"name": "Melodic Jungle", "desc": "Sliding scale walk \u2014 soulful sub"},
            {"name": "Sub Minimal", "desc": "One deep hit per bar \u2014 maximum weight"},
            {"name": "Rinse Bass", "desc": "Sliding root\u20135th \u2014 liquid jungle motion"},
        ],
    },

    "garage": {
        "s1": [
            {"name": "2-Step Melody", "desc": "Bouncy skippy lead \u2014 UKG signature bounce"},
            {"name": "R&B Chord", "desc": "Smooth chord progression \u2014 soulful harmony"},
            {"name": "Bassline Garage", "desc": "Wobbly bass lead \u2014 bass-heavy UKG"},
            {"name": "Vocal Chop", "desc": "Choppy vocal-style rhythm \u2014 diva garage"},
            {"name": "Skippy", "desc": "Ultra-bouncy groove \u2014 skippy 2-step"},
            {"name": "Deep Garage", "desc": "Deeper, more minimal \u2014 late-night vibes"},
            {"name": "Speed Garage", "desc": "Faster and bassier \u2014 speed garage energy"},
            {"name": "Garage Diva", "desc": "Soulful melodic line \u2014 R&B-house fusion"},
            {"name": "Shuffled", "desc": "Heavy shuffle feel \u2014 MPC swing energy"},
            {"name": "Night Drive", "desc": "Moody late-night \u2014 after-hours atmosphere"},
        ],
        "drums": [
            {"name": "2-Step Classic", "desc": "Skippy kick groove \u2014 signature UKG rhythm"},
            {"name": "Shuffled", "desc": "Heavy swing feel \u2014 MPC shuffle energy"},
            {"name": "Rimshot Bounce", "desc": "Rimshot on 2&4 \u2014 bouncing groove"},
            {"name": "South London", "desc": "Faster bassier groove \u2014 speed garage drive"},
            {"name": "Broken", "desc": "Irregular groove \u2014 off-kilter 2-step"},
            {"name": "Clap Garage", "desc": "Clap on 2&4 \u2014 classic UKG snap"},
            {"name": "Percussive", "desc": "Rimshots + cowbell \u2014 layered texture"},
            {"name": "Deep 2-Step", "desc": "Minimal groove \u2014 deep and sparse"},
            {"name": "UKG Roller", "desc": "Rolling hats \u2014 continuous motion"},
            {"name": "After Dark", "desc": "Darker feel \u2014 late-night atmosphere"},
        ],
        "bass": [
            {"name": "Skippy Walk", "desc": "Bouncing through intervals \u2014 skippy 2-step bass"},
            {"name": "Deep Bounce", "desc": "Offbeat sparse root \u2014 deep bounce"},
            {"name": "Wobbly", "desc": "Accent variation groove \u2014 wobbly sub"},
            {"name": "Sparse Deep", "desc": "Minimal with fifth \u2014 deep space"},
            {"name": "Shuffled Bass", "desc": "Shuffled rhythm walk \u2014 MPC groove"},
            {"name": "Quarter Sub", "desc": "Quarter-note sparse \u2014 simple and deep"},
            {"name": "Bassline Bounce", "desc": "Dense skippy bass \u2014 speed garage energy"},
            {"name": "Midnight Sub", "desc": "Moody sparse line \u2014 after-hours depth"},
            {"name": "Offbeat Walk", "desc": "Offbeat through intervals \u2014 bouncing motion"},
            {"name": "Sub Fifth", "desc": "Root\u20135th quarter notes \u2014 wide and clean"},
        ],
    },

    "ambient": {
        "s1": [
            {"name": "Glass Bells", "desc": "High register chimes \u2014 irregular crystalline drips"},
            {"name": "Tidal Breath", "desc": "Slow rise and fall \u2014 oceanic slide motion"},
            {"name": "Morse", "desc": "Rhythmic cluster then void \u2014 signal in silence"},
            {"name": "Bipolar", "desc": "Sub vs shimmer \u2014 extreme register contrast"},
            {"name": "Descending Mist", "desc": "Chromatic descent with velocity fade \u2014 dissolving"},
            {"name": "Constellation", "desc": "5 notes scattered asymmetrically \u2014 night sky map"},
            {"name": "Pendulum", "desc": "Two notes swinging with slides \u2014 slow oscillation"},
            {"name": "Rain on Glass", "desc": "Irregular drips at varied velocities \u2014 water music"},
            {"name": "Deep Call", "desc": "Sub drone answered by high echo \u2014 sonar ping"},
            {"name": "Frozen Lake", "desc": "Close interval cluster \u2014 icy microtonal texture"},
        ],
        "drums": [
            {"name": "Exhale", "desc": "Single kick pulse \u2014 life sign"},
            {"name": "Mist", "desc": "Faint hi-hat texture \u2014 barely audible"},
            {"name": "Rain", "desc": "Sparse rimshot drops \u2014 gentle rainfall"},
            {"name": "Abyss", "desc": "Single ride hit \u2014 near silence"},
            {"name": "Pulse", "desc": "Gentle kick + hat \u2014 minimal heartbeat"},
            {"name": "Shimmer", "desc": "Ride only \u2014 metallic glow"},
            {"name": "Tide", "desc": "Two gentle hits \u2014 tidal rhythm"},
            {"name": "Crystal", "desc": "Sparse cowbell \u2014 metallic drop"},
            {"name": "Drift", "desc": "Minimal textural \u2014 floating percussion"},
            {"name": "Horizon", "desc": "Wide-spaced hits \u2014 vast expanse"},
        ],
        "bass": [
            {"name": "Sub Tide", "desc": "Deep root with gentle swell \u2014 tidal pressure"},
            {"name": "Fifth Echo", "desc": "Root answered by distant fifth \u2014 harmonic reply"},
            {"name": "Glacial Slide", "desc": "Long slide root to fifth \u2014 ice-shelf motion"},
            {"name": "Riptide", "desc": "Sub pulls then releases \u2014 hidden current"},
            {"name": "Scattered", "desc": "Asymmetric gentle touches \u2014 random nature"},
            {"name": "Octave Space", "desc": "Sub and high octave \u2014 vast distance"},
            {"name": "Descending", "desc": "Gentle chromatic down \u2014 slow dissolve"},
            {"name": "Warm Pulse", "desc": "Two soft root hits close together \u2014 heartbeat"},
            {"name": "Call and Wait", "desc": "Note at start, response near end \u2014 patience"},
            {"name": "Deep Minimal", "desc": "One sub note, maximum space \u2014 essence only"},
        ],
    },

    "glitch": {
        "s1": [
            {"name": "Buffer Overflow", "desc": "Stuttering repeats \u2014 memory leak music"},
            {"name": "Bit Crush", "desc": "Extreme velocity contrasts \u2014 lo-fi digital"},
            {"name": "Skip", "desc": "Random-feeling gaps \u2014 CD scratch aesthetic"},
            {"name": "Micro Cut", "desc": "Tiny fragments \u2014 razor-edited atoms"},
            {"name": "Granular", "desc": "Dense cloud of notes \u2014 particle storm"},
            {"name": "Freeze", "desc": "Single note with glitchy gaps \u2014 frozen in time"},
            {"name": "Digital Debris", "desc": "Scattered fragments \u2014 broken data"},
            {"name": "Stretch", "desc": "Notes getting farther apart \u2014 time-stretched"},
            {"name": "Tape Stop", "desc": "Decelerating velocity \u2014 powering down"},
            {"name": "Reboot", "desc": "Silence then burst \u2014 system restart"},
        ],
        "drums": [
            {"name": "Buffer", "desc": "Stuttering repeats \u2014 looping glitch"},
            {"name": "Micro", "desc": "Tiny clicks \u2014 granular percussion"},
            {"name": "Scatter", "desc": "Random placement \u2014 algorithmic chaos"},
            {"name": "Stutter Kick", "desc": "Rapid kick stuttering \u2014 buffer overrun"},
            {"name": "Digital Debris", "desc": "Irregular percussion \u2014 broken fragments"},
            {"name": "Tape Stop", "desc": "Decelerating pattern \u2014 powering down"},
            {"name": "Reboot", "desc": "Silence then burst \u2014 system restart"},
            {"name": "Particle Cloud", "desc": "Dense tiny hits \u2014 particle percussion"},
            {"name": "Freeze Frame", "desc": "Repeating fragment \u2014 stuck loop"},
            {"name": "Error", "desc": "Intentionally wrong \u2014 beautiful mistake"},
        ],
        "bass": [
            {"name": "Stutter Sub", "desc": "Stuttering bass fragments \u2014 glitchy low end"},
            {"name": "Scatter Bass", "desc": "Random-feel bass hits \u2014 displaced notes"},
            {"name": "Decelerate", "desc": "Velocity decay \u2014 powering down bass"},
            {"name": "Late Burst", "desc": "Silence then bass burst \u2014 sudden impact"},
            {"name": "Micro Cluster", "desc": "Chromatic micro-cluster \u2014 granular bass"},
            {"name": "Freeze Loop", "desc": "Repeating fragment \u2014 stuck bass"},
            {"name": "Deep Stutter", "desc": "Single deep note \u2014 rare occurrence"},
            {"name": "Velocity Wave", "desc": "Velocity sweep \u2014 filter-like motion"},
            {"name": "Sparse Glitch", "desc": "Few displaced hits \u2014 negative space bass"},
            {"name": "Double Tap", "desc": "Stuttered accent pairs \u2014 echo glitch"},
        ],
    },

    "electro": {
        "s1": [
            {"name": "Robot Walk", "desc": "Mechanical stepping \u2014 android locomotion"},
            {"name": "Vocoder Riff", "desc": "Synth-voice style \u2014 talking machine"},
            {"name": "Trans-Europe", "desc": "Kraftwerk-inspired sequence \u2014 autobahn journey"},
            {"name": "Funk Machine", "desc": "Electro-funk groove \u2014 robotic boogie"},
            {"name": "808 Sub", "desc": "Deep 808 bass pattern \u2014 sub-heavy punch"},
            {"name": "Neon", "desc": "Bright synth arpeggio \u2014 city lights"},
            {"name": "Breakin'", "desc": "B-boy electro groove \u2014 cardboard floor energy"},
            {"name": "Cyber", "desc": "Futuristic sequence \u2014 dystopian melody"},
            {"name": "Power Grid", "desc": "Relentless 16th root \u2014 electrical current"},
            {"name": "Autobahn", "desc": "Motorik driving sequence \u2014 highway hypnosis"},
        ],
        "drums": [
            {"name": "808 Classic", "desc": "Classic electro beat \u2014 definitive 808 groove"},
            {"name": "Cowbell", "desc": "Cowbell pattern \u2014 more cowbell energy"},
            {"name": "Robot", "desc": "Mechanical precision \u2014 zero swing, pure grid"},
            {"name": "Breakdance", "desc": "B-boy beat \u2014 windmill-ready rhythm"},
            {"name": "Kraftwerk", "desc": "Minimal robotic \u2014 electronic music pioneers"},
            {"name": "Ocean Drive", "desc": "Boomy kick groove \u2014 bass-heavy bounce"},
            {"name": "Zapp", "desc": "Funky electro groove \u2014 talk-box vibes"},
            {"name": "Industrial Electro", "desc": "Heavy mechanical \u2014 factory-floor rhythm"},
            {"name": "Minimal Electro", "desc": "Sparse groove \u2014 essential elements only"},
            {"name": "Electro Funk", "desc": "Groovy electro \u2014 funky and robotic"},
        ],
        "bass": [
            {"name": "Stepping Bass", "desc": "Root with flat-five walk \u2014 robotic motion"},
            {"name": "808 Boom", "desc": "Deep 808 sub pattern \u2014 boomy punch"},
            {"name": "Doubled Walk", "desc": "Doubled stepping notes \u2014 mechanical pairs"},
            {"name": "Power Pump", "desc": "16th accent pattern \u2014 electrical pulse"},
            {"name": "Fifth Bounce", "desc": "Root\u2013fifth\u2013octave walk \u2014 wide movement"},
            {"name": "B-Boy Bass", "desc": "Sparse syncopated \u2014 breakdance groove"},
            {"name": "Slide Machine", "desc": "Sliding scale \u2014 gliding robot"},
            {"name": "Sub Pulse", "desc": "Half-note sub \u2014 simple and deep"},
            {"name": "Offbeat Robot", "desc": "Offbeat root pattern \u2014 mechanical groove"},
            {"name": "Octave Drop", "desc": "Root\u2013sub octave alternating \u2014 depth charge"},
        ],
    },

    "downtempo": {
        "s1": [
            {"name": "Velvet", "desc": "Smooth jazzy melody \u2014 late-night sophistication"},
            {"name": "Vinyl Crackle", "desc": "Sparse nostalgic feel \u2014 dusty record warmth"},
            {"name": "Midnight", "desc": "Dark moody phrase \u2014 shadowy atmosphere"},
            {"name": "Lazy River", "desc": "Slow flowing melody \u2014 drifting downstream"},
            {"name": "Dusty Keys", "desc": "Rhodes-like chord rhythm \u2014 vintage soul"},
            {"name": "Trip", "desc": "Psychedelic sparse \u2014 altered perception"},
            {"name": "Lounge", "desc": "Smooth and sophisticated \u2014 cocktail-bar cool"},
            {"name": "Haze", "desc": "Dreamy slow movement \u2014 half-remembered melody"},
            {"name": "Boom Bap Soul", "desc": "Hip-hop influenced \u2014 head-nodding groove"},
            {"name": "Sunset", "desc": "Warm descending line \u2014 golden-hour fade"},
        ],
        "drums": [
            {"name": "Bristol Beat", "desc": "Classic Bristol beat \u2014 Portishead vibes"},
            {"name": "Downtempo Minimal", "desc": "Sparse kick and snare \u2014 slow and patient"},
            {"name": "Lo-Fi", "desc": "Dusty feel groove \u2014 vinyl warmth"},
            {"name": "Jazz Brush", "desc": "Gentle brush strokes \u2014 ride cymbal warmth"},
            {"name": "Heavy", "desc": "Slow and powerful \u2014 deliberate weight"},
            {"name": "Shuffle", "desc": "Swung rhythm \u2014 laid-back groove"},
            {"name": "Ambient Beat", "desc": "Barely there \u2014 whisper percussion"},
            {"name": "Boom Bap", "desc": "Hip-hop crossover \u2014 head-nodding beat"},
            {"name": "Organic", "desc": "Natural feel \u2014 human touch"},
            {"name": "Film Noir", "desc": "Dramatic sparse \u2014 film-score moment"},
        ],
        "bass": [
            {"name": "Quarter Walk", "desc": "Quarter-note root walk \u2014 steady and warm"},
            {"name": "Deep Sparse", "desc": "Rare deep hits \u2014 oceanic depth"},
            {"name": "Minor Walk", "desc": "Minor scale movement \u2014 melancholic groove"},
            {"name": "Slide Drift", "desc": "Sliding root\u20135th \u2014 glacial motion"},
            {"name": "Boom Bap Bass", "desc": "Hip-hop style bass \u2014 head-nodding weight"},
            {"name": "Single Root", "desc": "One root per bar \u2014 maximum space"},
            {"name": "Fifth Space", "desc": "Root\u20135th quarter notes \u2014 wide and warm"},
            {"name": "Off-Grid", "desc": "Displaced hits \u2014 lazy timing"},
            {"name": "Gentle Pulse", "desc": "Soft rhythmic root \u2014 heartbeat bass"},
            {"name": "Slow Slide", "desc": "Long slides between notes \u2014 dreamy low end"},
        ],
    },
}


# ─── MAIN ─────────────────────────────────────────────────

def validate_pattern(pattern, kind):
    """Validate a single pattern."""
    assert len(pattern) == STEPS, f"Pattern has {len(pattern)} steps, expected {STEPS}"
    for i, step in enumerate(pattern):
        if kind in ("s1", "bass"):
            if step is not None:
                assert "semi" in step, f"Step {i} missing 'semi'"
                assert "vel" in step, f"Step {i} missing 'vel'"
                assert "slide" in step, f"Step {i} missing 'slide'"
                assert -24 <= step["semi"] <= 24, f"Step {i} semi={step['semi']} out of range"
                assert 0.5 <= step["vel"] <= 1.3, f"Step {i} vel={step['vel']} out of range"
        elif kind == "drums":
            assert isinstance(step, list), f"Step {i} should be a list"
            for hit in step:
                assert "note" in hit, f"Step {i} hit missing 'note'"
                assert "vel" in hit, f"Step {i} hit missing 'vel'"
                assert hit["note"] in (BD, RS, SD, CH, OH, CB, CY, CP, RD), f"Step {i} invalid note={hit['note']}"
                assert 50 <= hit["vel"] <= 120, f"Step {i} vel={hit['vel']} out of range"


def main():
    # Load existing files
    s1_path = os.path.join(DATA_DIR, "patterns-s1.json")
    drums_path = os.path.join(DATA_DIR, "patterns-t8-drums.json")
    bass_path = os.path.join(DATA_DIR, "patterns-t8-bass.json")
    catalog_path = os.path.join(DATA_DIR, "catalog.json")

    with open(s1_path) as f:
        s1_data = json.load(f)
    with open(drums_path) as f:
        drums_data = json.load(f)
    with open(bass_path) as f:
        bass_data = json.load(f)
    with open(catalog_path) as f:
        catalog = json.load(f)

    # Validate and append new patterns
    for genre in GENRES:
        print(f"Processing {genre}...")

        # S-1 synth
        new_s1 = s1_patterns_for(genre)
        for i, p in enumerate(new_s1):
            validate_pattern(p, "s1")
        s1_data[genre].extend(new_s1)

        # T-8 drums
        new_drums = drum_patterns_for(genre)
        for i, p in enumerate(new_drums):
            validate_pattern(p, "drums")
        drums_data[genre].extend(new_drums)

        # T-8 bass
        new_bass = bass_patterns_for(genre)
        for i, p in enumerate(new_bass):
            validate_pattern(p, "bass")
        bass_data[genre].extend(new_bass)

        # Update catalog
        names = CATALOG_NAMES[genre]

        # Find the genre in catalog.s1.genres
        for g in catalog["s1"]["genres"]:
            if g["name"] == genre:
                g["patterns"].extend(names["s1"])
                break

        for g in catalog["t8"]["drum_genres"]:
            if g["name"] == genre:
                g["patterns"].extend(names["drums"])
                break

        for g in catalog["t8"]["bass_genres"]:
            if g["name"] == genre:
                g["patterns"].extend(names["bass"])
                break

    # Write updated files
    with open(s1_path, "w") as f:
        json.dump(s1_data, f, separators=(",", ":"))
    with open(drums_path, "w") as f:
        json.dump(drums_data, f, separators=(",", ":"))
    with open(bass_path, "w") as f:
        json.dump(bass_data, f, separators=(",", ":"))
    with open(catalog_path, "w") as f:
        json.dump(catalog, f, separators=(",", ":"))

    # Print summary
    print("\n=== Summary ===")
    for genre in GENRES:
        s1_count = len(s1_data[genre])
        drums_count = len(drums_data[genre])
        bass_count = len(bass_data[genre])
        cat_s1 = cat_drums = cat_bass = 0
        for g in catalog["s1"]["genres"]:
            if g["name"] == genre:
                cat_s1 = len(g["patterns"])
        for g in catalog["t8"]["drum_genres"]:
            if g["name"] == genre:
                cat_drums = len(g["patterns"])
        for g in catalog["t8"]["bass_genres"]:
            if g["name"] == genre:
                cat_bass = len(g["patterns"])
        ok = "OK" if s1_count == cat_s1 and drums_count == cat_drums and bass_count == cat_bass else "MISMATCH"
        print(f"  {genre}: S1={s1_count}(cat={cat_s1}) drums={drums_count}(cat={cat_drums}) bass={bass_count}(cat={cat_bass}) [{ok}]")

    print("\nDone! Files updated.")


if __name__ == "__main__":
    main()
