#!/usr/bin/env python3
"""Generate patterns for 5 new genres: dubstep, lo-fi, synthwave, deep-house, psytrance.

Each genre gets 20 S-1 synth, T-8 drum, and T-8 bass patterns.
Patterns are researched from genre-specific production guides and
follow authentic rhythmic and melodic conventions.

Run: python3 scripts/generate_new_genres.py
Output: Appends to public/data/ JSON files and catalog.json
"""

import json
import os

STEPS = 16
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "data")

# Drum voice MIDI notes
BD, RS, SD, CH, OH, CB, CY, CP, RD = 36, 37, 38, 42, 46, 47, 49, 50, 51

NEW_GENRES = ["dubstep", "lo-fi", "synthwave", "deep-house", "psytrance"]


def N(semi, vel=1.0, slide=False):
    """Create a melodic note step."""
    return {"semi": semi, "vel": round(vel, 2), "slide": bool(slide)}

def H(note, vel=100):
    """Create a drum hit."""
    return {"note": note, "vel": vel}

R = None  # rest


# ═══════════════════════════════════════════════════════════════════════════
#  DUBSTEP — 140 BPM, half-time feel (kick on 1, snare on 3)
#  Sparse drums, heavy sub bass, wobble, atmospheric
# ═══════════════════════════════════════════════════════════════════════════

DUBSTEP_SYNTH = [
    # 1. Dark Atmosphere — sparse minor stabs
    [N(0,1.2), R, R, R, R, R, R, N(3), R, R, R, R, N(7), R, R, R],
    # 2. Melodic Drift — slow evolving melody
    [N(0), R, N(3), R, N(7), R, N(10), R, N(12), R, N(10), R, N(7), R, N(3), R],
    # 3. Stab Rhythm — syncopated chord hits
    [N(0,1.3), R, R, N(0,0.8), R, R, N(3,1.0), R, R, R, N(7,1.2), R, R, R, R, R],
    # 4. Octave Drops — dramatic pitch movement
    [N(12,1.3), R, R, R, N(0,1.0), R, R, R, N(12,1.3), R, R, R, N(0,1.0), R, R, R],
    # 5. Tension Build — chromatic rise
    [N(0), N(1), N(2), N(3), N(4), N(5), N(6), N(7), N(8), N(9), N(10), N(11), N(12), R, R, R],
    # 6. Void — minimal pad hits
    [N(0,0.8), R, R, R, R, R, R, R, N(7,0.6), R, R, R, R, R, R, R],
    # 7. Broken Chords — arpeggiated minor
    [N(0), R, N(3), R, N(7), R, N(3), R, N(0), R, N(-5), R, N(0), R, N(3), R],
    # 8. Sub Drone — root with occasional movement
    [N(0), R, R, R, R, R, R, N(-2), N(0), R, R, R, R, R, R, R],
    # 9. Glitch Stutter — rapid repeats then silence
    [N(0), N(0), N(0), N(0), R, R, R, R, R, R, R, R, N(0), N(0), R, R],
    # 10. Cinematic — wide intervals
    [N(0,1.2), R, R, R, R, R, N(7,1.0), R, R, R, R, R, N(12,0.8), R, R, R],
    # 11. Half-time Groove — accented downbeats
    [N(0,1.3), R, R, R, R, R, R, R, N(5,1.1), R, R, R, R, R, R, R],
    # 12. Minor Cascade — descending scale
    [N(12), N(10), N(7), N(5), N(3), N(0), R, R, N(12), N(10), N(7), N(5), N(3), N(0), R, R],
    # 13. Sparse Melody — breathing space
    [N(0), R, R, R, N(3), R, R, R, R, R, N(7), R, R, R, R, R],
    # 14. Power Chord — root + fifth stabs
    [N(0,1.3), R, R, R, R, R, R, R, N(7,1.3), R, R, R, R, R, R, R],
    # 15. Wobble Rhythm — matches bass LFO
    [N(0), N(0), R, N(0), R, R, N(0), N(0), R, N(0), R, R, N(0), N(0), R, R],
    # 16. Ambient Texture — slow pads
    [N(0,0.6), R, R, R, R, R, R, R, R, R, R, R, R, R, R, R],
    # 17. Tritone Tension
    [N(0,1.2), R, R, R, N(6,1.0), R, R, R, N(0,1.2), R, R, R, N(6,1.0), R, R, R],
    # 18. Call and Response
    [N(0), N(3), N(7), R, R, R, R, R, N(12), N(10), N(7), R, R, R, R, R],
    # 19. Minimal Pulse
    [N(0,1.0), R, R, R, N(0,0.7), R, R, R, N(0,1.0), R, R, R, N(0,0.7), R, R, R],
    # 20. Reese Stab
    [N(0,1.3), R, R, N(0,0.5,True), R, R, R, R, N(-5,1.3), R, R, N(-5,0.5,True), R, R, R, R],
]

DUBSTEP_DRUMS = [
    # 1. Classic Half-Time — kick 1, snare 3
    [[H(BD,120),H(CH,80)],[H(CH,70)],[H(CH,80)],[H(CH,70)],[H(CH,80)],[H(CH,70)],[H(CH,80)],[H(CH,70)],
     [H(SD,120),H(CH,80)],[H(CH,70)],[H(CH,80)],[H(CH,70)],[H(CH,80)],[H(CH,70)],[H(CH,80)],[H(CH,70)]],
    # 2. Sparse Kick Snare — minimal
    [[H(BD,120)],[],[],[],[],[],[],[],[H(SD,120)],[],[],[],[],[],[],[]],
    # 3. Broken — syncopated kick
    [[H(BD,120)],[],[],[H(BD,90)],[],[],[],[],[H(SD,120)],[],[],[],[H(BD,80)],[],[],[]],
    # 4. Heavy — sub-heavy kick + clap on 3
    [[H(BD,127)],[],[],[],[],[],[],[],[H(CP,120),H(SD,100)],[],[],[],[],[],[],[]],
    # 5. Triplet Hats — swing feel
    [[H(BD,120),H(CH,90)],[],[H(CH,60)],[H(CH,90)],[],[H(CH,60)],[H(CH,90)],[],[H(SD,120),H(CH,90)],[],[H(CH,60)],[H(CH,90)],[],[H(CH,60)],[H(CH,90)],[]],
    # 6. Rim Pattern — rimshot accents
    [[H(BD,120)],[H(RS,60)],[],[H(RS,60)],[],[H(RS,60)],[],[H(RS,60)],[H(SD,120)],[H(RS,60)],[],[H(RS,60)],[],[H(RS,60)],[],[H(RS,60)]],
    # 7. Open Hat Groove
    [[H(BD,120),H(OH,70)],[],[H(CH,60)],[],[],[],[H(CH,60)],[],[H(SD,120),H(OH,70)],[],[H(CH,60)],[],[],[],[H(CH,60)],[]],
    # 8. Double Kick — two kicks before snare
    [[H(BD,120)],[],[],[],[],[],[H(BD,100)],[],[H(SD,120)],[],[],[],[],[],[],[]],
    # 9. Ride Groove — ride instead of hats
    [[H(BD,120),H(RD,70)],[],[H(RD,50)],[],[H(RD,70)],[],[H(RD,50)],[],[H(SD,120),H(RD,70)],[],[H(RD,50)],[],[H(RD,70)],[],[H(RD,50)],[]],
    # 10. Snare Roll Fill
    [[H(BD,120)],[],[],[],[],[],[],[],[H(SD,100)],[H(SD,80)],[H(SD,100)],[H(SD,80)],[H(SD,120)],[H(SD,80)],[H(SD,100)],[H(SD,80)]],
    # 11-20: variations
    [[H(BD,127),H(CH,90)],[],[H(CH,70)],[],[H(CH,90)],[],[H(CH,70)],[],[H(CP,120),H(CH,90)],[],[H(CH,70)],[],[H(CH,90)],[],[H(CH,70)],[]],
    [[H(BD,120)],[],[],[],[H(BD,80)],[],[],[],[H(SD,127)],[],[],[],[],[],[H(BD,80)],[]],
    [[H(BD,120),H(RD,80)],[],[],[],[],[],[],[H(BD,80)],[H(SD,120),H(RD,80)],[],[],[],[],[],[],[]],
    [[H(BD,127)],[H(CH,50)],[H(CH,70)],[H(CH,50)],[H(CH,70)],[H(CH,50)],[H(CH,70)],[H(CH,50)],[H(SD,127)],[H(CH,50)],[H(CH,70)],[H(CH,50)],[H(CH,70)],[H(CH,50)],[H(CH,70)],[H(CH,50)]],
    [[H(BD,120)],[],[],[],[],[],[],[],[H(SD,120),H(CP,100)],[],[],[],[],[],[H(BD,90)],[H(BD,70)]],
    [[H(BD,127),H(CH,80)],[],[],[],[H(CH,60)],[],[],[],[H(SD,127),H(CH,80)],[],[],[],[H(CH,60)],[],[],[]],
    [[H(BD,120)],[],[H(RS,70)],[],[],[],[H(RS,70)],[],[H(SD,120)],[],[H(RS,70)],[],[],[],[H(RS,70)],[]],
    [[H(BD,120),H(OH,80)],[],[],[],[],[],[],[],[H(CP,120)],[],[],[],[H(BD,80)],[],[],[]],
    [[H(BD,127)],[],[],[H(CH,60)],[],[H(CH,60)],[],[],[H(SD,120)],[],[],[H(CH,60)],[],[H(CH,60)],[],[]],
    [[H(BD,120),H(CH,90)],[],[H(CH,60)],[],[],[],[H(CH,60)],[],[H(SD,120),H(OH,90)],[],[],[],[H(BD,80)],[],[H(CH,60)],[]],
]

DUBSTEP_BASS = [
    # 1. Sub Root — sustained sub bass
    [N(0), R, R, R, R, R, R, R, N(0), R, R, R, R, R, R, R],
    # 2. Wobble — root with slides
    [N(0), N(0,0.8,True), N(0,0.6,True), N(0,0.8), R, R, R, R, N(0), N(0,0.8,True), N(0,0.6,True), N(0,0.8), R, R, R, R],
    # 3. Drop Pattern — octave drops
    [N(0,1.3), R, R, R, N(-12,1.0), R, R, R, N(0,1.3), R, R, R, N(-12,1.0), R, R, R],
    # 4. Syncopated Sub
    [N(0,1.2), R, R, N(0,0.8), R, R, R, R, R, R, N(0,1.0), R, R, R, R, R],
    # 5. Minor Movement
    [N(0), R, R, R, N(3), R, R, R, N(0), R, R, R, N(-2), R, R, R],
    # 6. Pulsing Sub
    [N(0,1.0), R, N(0,0.6), R, N(0,1.0), R, N(0,0.6), R, N(0,1.0), R, N(0,0.6), R, N(0,1.0), R, N(0,0.6), R],
    # 7. Growl Bass — chromatic slides
    [N(0,1.3), N(1,1.0,True), N(0,1.0,True), R, R, R, R, R, N(0,1.3), N(-1,1.0,True), N(0,1.0,True), R, R, R, R, R],
    # 8. Sparse Hits
    [N(0,1.3), R, R, R, R, R, R, R, R, R, R, R, R, R, R, R],
    # 9. Fifth Drop
    [N(7,1.0), R, R, R, N(0,1.3), R, R, R, N(7,1.0), R, R, R, N(0,1.3), R, R, R],
    # 10. Stutter Bass
    [N(0), N(0), N(0), R, R, R, R, R, N(0), N(0), N(0), R, R, R, R, R],
    # 11-20: more variations
    [N(0,1.3), R, R, R, R, R, R, R, N(-5,1.0), R, R, R, R, R, R, R],
    [N(0), R, N(0,0.7), R, R, R, N(0,0.7), R, N(0), R, N(0,0.7), R, R, R, N(0,0.7), R],
    [N(0,1.2), R, R, R, N(3,1.0), R, R, R, N(5,1.2), R, R, R, N(3,1.0), R, R, R],
    [N(0), R, R, R, R, R, R, N(-7,1.0), N(0), R, R, R, R, R, R, R],
    [N(0,1.3), R, N(0,0.5,True), R, R, R, R, R, N(-12,1.3), R, N(-12,0.5,True), R, R, R, R, R],
    [N(0), R, R, R, R, R, R, R, N(0), R, R, R, N(-5), R, N(-3), R],
    [N(0,1.0), N(0,0.8), R, R, R, R, R, R, N(5,1.0), N(5,0.8), R, R, R, R, R, R],
    [N(0), R, R, N(0,0.6), R, R, R, R, N(-2), R, R, N(-2,0.6), R, R, R, R],
    [N(0,1.3), R, R, R, R, R, N(-12,1.0), R, N(0,1.3), R, R, R, R, R, N(-12,1.0), R],
    [N(0), R, R, R, R, R, R, R, R, R, R, R, N(0), N(0), N(0), N(0)],
]


# ═══════════════════════════════════════════════════════════════════════════
#  LO-FI HIP-HOP — 80 BPM, laid-back, jazzy, mellow
#  Kick 1+3, snare 2+4, subtle hats, warm chords
# ═══════════════════════════════════════════════════════════════════════════

LOFI_SYNTH = [
    # 1. Jazz Chord — 7th chord voicing
    [N(0), R, R, R, N(4), R, R, R, N(7), R, R, R, N(11), R, R, R],
    # 2. Mellow Melody — pentatonic
    [N(0), R, N(3), R, N(5), R, N(7), R, N(10), R, N(7), R, N(5), R, N(3), R],
    # 3. Rhodes Stabs — offbeat hits
    [R, N(0,0.9), R, R, R, N(4,0.8), R, R, R, N(7,0.9), R, R, R, N(4,0.8), R, R],
    # 4. Dreamy Pad — long notes
    [N(0,0.7), R, R, R, R, R, R, R, N(5,0.6), R, R, R, R, R, R, R],
    # 5. Walking Notes — stepwise
    [N(0), R, N(2), R, N(3), R, N(5), R, N(7), R, N(5), R, N(3), R, N(2), R],
    # 6. Sparse Chords — breathing room
    [N(0,0.8), R, R, R, R, R, R, R, R, R, R, R, N(5,0.7), R, R, R],
    # 7. Minor 9th Feel
    [N(0), R, N(3), R, N(7), R, N(10), R, N(14), R, N(10), R, N(7), R, N(3), R],
    # 8. Rainy Day — descending
    [N(7), R, N(5), R, N(3), R, N(2), R, N(0), R, R, R, R, R, R, R],
    # 9. Nostalgic Loop — simple and warm
    [N(0), R, R, N(3), R, R, N(5), R, R, N(3), R, R, N(0), R, R, R],
    # 10. Late Night — very sparse
    [N(0,0.6), R, R, R, R, R, R, R, R, R, R, R, R, R, N(7,0.5), R],
    [N(0), R, N(4), R, N(7), R, N(11), R, N(12), R, N(11), R, N(7), R, N(4), R],
    [R, R, N(0,0.8), R, R, R, N(5,0.7), R, R, R, N(3,0.8), R, R, R, R, R],
    [N(0), R, R, R, N(3), R, R, R, N(7), R, R, R, N(5), R, R, R],
    [N(0,0.7), R, R, R, R, R, R, R, N(7,0.6), R, R, R, N(5,0.5), R, R, R],
    [N(0), N(3), R, N(5), R, R, N(7), R, N(5), N(3), R, N(0), R, R, R, R],
    [R, N(0,0.8), R, N(4,0.7), R, R, R, N(7,0.8), R, N(4,0.7), R, R, R, R, R, R],
    [N(0), R, R, R, N(2), R, N(3), R, N(5), R, R, R, N(3), R, N(2), R],
    [N(7,0.7), R, N(5,0.6), R, R, R, N(3,0.7), R, N(0,0.6), R, R, R, R, R, R, R],
    [N(0), R, N(0), R, N(3), R, R, R, N(5), R, N(5), R, N(7), R, R, R],
    [N(0,0.6), R, R, R, R, R, R, R, R, R, R, R, R, R, R, R],
]

LOFI_DRUMS = [
    # 1. Classic Boom Bap — kick 1+3, snare 2+4
    [[H(BD,100)],[],[],[],[H(SD,90)],[],[],[],[H(BD,100)],[],[],[],[H(SD,90)],[],[],[]],
    # 2. Lazy Groove — pushed kick
    [[H(BD,90)],[],[],[H(BD,70)],[H(SD,85)],[],[],[],[],[],[H(BD,80)],[],[H(SD,85)],[],[],[]],
    # 3. Ride Feel — ride instead of hats
    [[H(BD,90),H(RD,60)],[],[H(RD,40)],[],[H(SD,85),H(RD,60)],[],[H(RD,40)],[],[H(BD,90),H(RD,60)],[],[H(RD,40)],[],[H(SD,85),H(RD,60)],[],[H(RD,40)],[]],
    # 4. Minimal — just kick and snare
    [[H(BD,80)],[],[],[],[H(SD,75)],[],[],[],[H(BD,80)],[],[],[],[H(SD,75)],[],[],[]],
    # 5. Ghost Notes — subtle hat pattern
    [[H(BD,90),H(CH,40)],[H(CH,30)],[H(CH,40)],[H(CH,30)],[H(SD,85),H(CH,40)],[H(CH,30)],[H(CH,40)],[H(CH,30)],[H(BD,90),H(CH,40)],[H(CH,30)],[H(CH,40)],[H(CH,30)],[H(SD,85),H(CH,40)],[H(CH,30)],[H(CH,40)],[H(CH,30)]],
    # 6. Swung — offbeat feel
    [[H(BD,90)],[],[H(CH,40)],[],[H(SD,85)],[],[H(CH,40)],[],[H(BD,80)],[],[H(CH,40)],[H(BD,70)],[H(SD,85)],[],[H(CH,40)],[]],
    # 7. Open Hat Accent
    [[H(BD,90)],[],[],[],[H(SD,85),H(OH,50)],[],[],[],[H(BD,90)],[],[],[],[H(SD,85),H(OH,50)],[],[],[]],
    # 8-20: more variations
    [[H(BD,85)],[],[H(CH,35)],[],[H(SD,80)],[],[H(CH,35)],[],[H(BD,85)],[],[H(CH,35)],[],[H(SD,80)],[],[H(CH,35)],[]],
    [[H(BD,90)],[],[],[],[H(SD,85)],[],[],[],[H(BD,70)],[],[H(BD,80)],[],[H(SD,85)],[],[],[]],
    [[H(BD,80),H(RD,50)],[],[],[],[H(SD,80)],[],[],[],[H(BD,80),H(RD,50)],[],[],[],[H(SD,80)],[],[H(RD,40)],[]],
    [[H(BD,90)],[],[],[],[H(CP,80)],[],[],[],[H(BD,90)],[],[],[],[H(CP,80)],[],[],[]],
    [[H(BD,85),H(CH,40)],[],[H(CH,30)],[],[H(SD,80),H(CH,40)],[],[H(CH,30)],[],[H(BD,70),H(CH,40)],[],[H(CH,30)],[H(BD,80)],[H(SD,85),H(CH,40)],[],[H(CH,30)],[]],
    [[H(BD,90)],[],[],[],[H(SD,85)],[],[],[],[],[],[H(BD,80)],[],[H(SD,85)],[],[],[]],
    [[H(BD,80)],[],[H(RS,40)],[],[H(SD,80)],[],[H(RS,40)],[],[H(BD,80)],[],[H(RS,40)],[],[H(SD,80)],[],[H(RS,40)],[]],
    [[H(BD,90)],[],[],[H(BD,60)],[H(SD,80)],[],[],[],[H(BD,90)],[],[],[],[H(SD,80)],[],[H(BD,60)],[]],
    [[H(BD,85),H(OH,40)],[],[],[],[H(SD,80)],[],[],[],[H(BD,85)],[],[],[],[H(SD,80),H(OH,40)],[],[],[]],
    [[H(BD,90)],[],[],[],[H(SD,85)],[],[H(CH,30)],[],[H(BD,80)],[],[H(CH,30)],[],[H(SD,85)],[],[],[]],
    [[H(BD,80)],[],[],[],[H(CP,75)],[],[],[],[H(BD,80)],[],[],[H(BD,60)],[H(CP,75)],[],[],[]],
    [[H(BD,90),H(CH,35)],[],[H(CH,25)],[],[H(SD,80),H(CH,35)],[],[H(CH,25)],[],[H(BD,80),H(CH,35)],[],[H(CH,25)],[],[H(SD,80),H(CH,35)],[],[H(CH,25)],[]],
    [[H(BD,85)],[],[],[],[H(SD,80)],[],[],[],[H(BD,70)],[],[],[],[H(SD,80)],[],[],[H(BD,60)]],
]

LOFI_BASS = [
    # 1. Walking Bass — stepwise movement
    [N(0), R, N(2), R, N(3), R, N(5), R, N(7), R, N(5), R, N(3), R, N(2), R],
    # 2. Root Fifth — simple
    [N(0), R, R, R, N(7), R, R, R, N(0), R, R, R, N(7), R, R, R],
    # 3. Jazzy Line — chromatic approach
    [N(0), R, N(4), R, N(5), R, N(7), R, N(5), R, N(4), R, N(0), R, R, R],
    # 4. Mellow Pulse
    [N(0,0.8), R, R, R, R, R, R, R, N(0,0.8), R, R, R, R, R, R, R],
    # 5. Octave Bounce
    [N(0), R, N(-12), R, N(0), R, N(-12), R, N(0), R, N(-12), R, N(0), R, N(-12), R],
    # 6-20: more patterns
    [N(0), R, R, N(3), R, R, N(5), R, R, N(3), R, R, N(0), R, R, R],
    [N(0), R, N(7), R, N(5), R, N(3), R, N(0), R, N(-5), R, N(0), R, R, R],
    [N(0,0.9), R, R, R, R, R, N(5,0.7), R, R, R, R, R, N(3,0.8), R, R, R],
    [N(0), R, R, R, N(0), R, R, R, N(5), R, R, R, N(3), R, R, R],
    [N(0), R, N(2), R, N(3), R, R, R, N(5), R, N(3), R, N(0), R, R, R],
    [N(0,0.8), R, R, R, N(-5,0.7), R, R, R, N(0,0.8), R, R, R, N(3,0.7), R, R, R],
    [N(0), R, R, R, R, R, R, R, N(-7), R, R, R, R, R, R, R],
    [N(0), N(0), R, R, N(5), N(5), R, R, N(3), N(3), R, R, N(0), R, R, R],
    [N(0), R, R, R, N(3), R, R, R, N(5), R, R, R, N(7), R, R, R],
    [N(0,0.7), R, R, R, R, R, R, R, N(5,0.6), R, R, R, R, R, R, R],
    [N(0), R, N(3), R, R, R, N(7), R, N(5), R, N(3), R, R, R, N(0), R],
    [N(0), R, R, R, R, R, R, N(-2), N(0), R, R, R, R, R, R, R],
    [N(0), R, R, R, N(5), R, R, R, N(0), R, R, R, N(7), R, R, R],
    [N(0,0.9), R, N(0,0.5), R, R, R, N(5,0.7), R, N(0,0.9), R, N(0,0.5), R, R, R, N(3,0.7), R],
    [N(0), R, R, R, R, R, R, R, R, R, R, R, N(-5), R, N(0), R],
]


# ═══════════════════════════════════════════════════════════════════════════
#  SYNTHWAVE — 118 BPM, retro 80s, arpeggiated, driving
#  Four-on-floor or kick 1+3/snare 2+4, gated reverb, big cymbals
# ═══════════════════════════════════════════════════════════════════════════

SYNTHWAVE_SYNTH = [
    # 1. Arp Up — classic ascending arp
    [N(0), N(3), N(7), N(12), N(0), N(3), N(7), N(12), N(0), N(3), N(7), N(12), N(0), N(3), N(7), N(12)],
    # 2. Gated Pad — sustained with rhythmic feel
    [N(0,1.0), R, N(0,0.7), R, N(0,1.0), R, N(0,0.7), R, N(0,1.0), R, N(0,0.7), R, N(0,1.0), R, N(0,0.7), R],
    # 3. Power Melody — heroic theme
    [N(0), R, N(3), N(5), N(7), R, N(5), N(3), N(0), R, N(3), N(5), N(7), R, N(12), R],
    # 4. Blade Runner — moody, slow
    [N(0,0.8), R, R, R, N(3,0.7), R, R, R, N(7,0.8), R, R, R, N(5,0.7), R, R, R],
    # 5. Outrun Arp — descending
    [N(12), N(10), N(7), N(5), N(3), N(0), N(3), N(5), N(12), N(10), N(7), N(5), N(3), N(0), N(3), N(5)],
    # 6. Neon Stabs — offbeat chord stabs
    [R, N(0,1.2), R, R, R, N(0,1.2), R, R, R, N(0,1.2), R, R, R, N(0,1.2), R, R],
    # 7. Synth Lead — soaring melody
    [N(0), R, N(5), R, N(7), R, N(12), R, N(10), R, N(7), R, N(5), R, N(3), R],
    # 8. Chase Scene — fast repeated notes
    [N(0), N(0), N(3), N(3), N(5), N(5), N(7), N(7), N(0), N(0), N(3), N(3), N(5), N(5), N(7), N(7)],
    # 9. Sunset Pad — whole notes
    [N(0,0.7), R, R, R, R, R, R, R, N(7,0.6), R, R, R, R, R, R, R],
    # 10. Retrograde — reverse arp
    [N(12), N(7), N(3), N(0), N(12), N(7), N(3), N(0), N(12), N(7), N(3), N(0), N(12), N(7), N(3), N(0)],
    [N(0), R, N(7), R, N(0), R, N(7), R, N(0), R, N(7), R, N(0), R, N(7), R],
    [N(0), N(5), N(7), R, N(0), N(5), N(7), R, N(3), N(7), N(10), R, N(3), N(7), N(10), R],
    [N(0,1.2), R, R, R, R, R, R, R, N(5,1.0), R, R, R, R, R, R, R],
    [N(0), N(3), N(7), N(10), N(12), N(10), N(7), N(3), N(0), R, R, R, R, R, R, R],
    [R, N(0), R, N(3), R, N(7), R, N(10), R, N(12), R, N(10), R, N(7), R, N(3)],
    [N(0), R, N(0), R, N(0), R, N(3), R, N(5), R, N(5), R, N(7), R, N(7), R],
    [N(0,1.0), N(0,0.5), R, R, N(5,1.0), N(5,0.5), R, R, N(7,1.0), N(7,0.5), R, R, N(5,1.0), N(5,0.5), R, R],
    [N(0), R, R, N(12), R, R, N(0), R, R, N(12), R, R, N(0), R, R, N(12)],
    [N(0), N(3), N(5), N(7), N(5), N(3), N(0), R, N(0), N(3), N(5), N(7), N(5), N(3), N(0), R],
    [N(0,0.8), R, R, R, N(0,0.8), R, R, R, N(5,0.8), R, R, R, N(3,0.8), R, R, R],
]

SYNTHWAVE_DRUMS = [
    # 1. Classic 80s — kick 1+3, snare 2+4, driving hats
    [[H(BD,110),H(CH,80)],[H(CH,60)],[H(CH,80)],[H(CH,60)],[H(SD,110),H(CH,80)],[H(CH,60)],[H(CH,80)],[H(CH,60)],[H(BD,110),H(CH,80)],[H(CH,60)],[H(CH,80)],[H(CH,60)],[H(SD,110),H(CH,80)],[H(CH,60)],[H(CH,80)],[H(CH,60)]],
    # 2. Four-on-floor — disco-influenced
    [[H(BD,110),H(CH,70)],[H(CH,50)],[H(BD,100),H(CH,70)],[H(CH,50)],[H(BD,110),H(SD,100),H(CH,70)],[H(CH,50)],[H(BD,100),H(CH,70)],[H(CH,50)],[H(BD,110),H(CH,70)],[H(CH,50)],[H(BD,100),H(CH,70)],[H(CH,50)],[H(BD,110),H(SD,100),H(CH,70)],[H(CH,50)],[H(BD,100),H(CH,70)],[H(CH,50)]],
    # 3. Big Snare — gated snare emphasis
    [[H(BD,120)],[H(CH,60)],[H(CH,70)],[H(CH,60)],[H(SD,127)],[H(CH,60)],[H(CH,70)],[H(CH,60)],[H(BD,120)],[H(CH,60)],[H(CH,70)],[H(CH,60)],[H(SD,127)],[H(CH,60)],[H(CH,70)],[H(CH,60)]],
    # 4. Tom Fill — tom-heavy
    [[H(BD,110),H(CH,70)],[H(CH,50)],[H(CH,70)],[H(CH,50)],[H(SD,100),H(CH,70)],[H(CH,50)],[H(CH,70)],[H(CH,50)],[H(BD,110),H(CH,70)],[H(CH,50)],[H(CH,70)],[H(CH,50)],[H(SD,100),H(CH,70)],[H(CH,50)],[H(CP,80)],[H(CP,70)]],
    # 5. Ride Groove
    [[H(BD,100),H(RD,70)],[H(RD,50)],[H(RD,70)],[H(RD,50)],[H(SD,100),H(RD,70)],[H(RD,50)],[H(RD,70)],[H(RD,50)],[H(BD,100),H(RD,70)],[H(RD,50)],[H(RD,70)],[H(RD,50)],[H(SD,100),H(RD,70)],[H(RD,50)],[H(RD,70)],[H(RD,50)]],
    # 6-20: variations
    [[H(BD,110)],[H(CH,50)],[H(CH,70)],[H(CH,50)],[H(CP,110)],[H(CH,50)],[H(CH,70)],[H(CH,50)],[H(BD,110)],[H(CH,50)],[H(CH,70)],[H(CH,50)],[H(CP,110)],[H(CH,50)],[H(CH,70)],[H(CH,50)]],
    [[H(BD,120),H(OH,70)],[],[H(CH,60)],[],[H(SD,120),H(OH,70)],[],[H(CH,60)],[],[H(BD,120),H(OH,70)],[],[H(CH,60)],[],[H(SD,120),H(OH,70)],[],[H(CH,60)],[]],
    [[H(BD,110),H(CH,80)],[H(CH,50)],[H(BD,80),H(CH,60)],[H(CH,50)],[H(SD,110),H(CH,80)],[H(CH,50)],[H(CH,60)],[H(CH,50)],[H(BD,110),H(CH,80)],[H(CH,50)],[H(BD,80),H(CH,60)],[H(CH,50)],[H(SD,110),H(CH,80)],[H(CH,50)],[H(CH,60)],[H(CH,50)]],
    [[H(BD,110)],[],[H(CH,70)],[],[H(SD,100)],[],[H(CH,70)],[],[H(BD,110)],[],[H(CH,70)],[],[H(SD,100)],[],[H(CH,70)],[H(BD,80)]],
    [[H(BD,120),H(CY,60)],[H(CH,50)],[H(CH,70)],[H(CH,50)],[H(SD,120)],[H(CH,50)],[H(CH,70)],[H(CH,50)],[H(BD,120)],[H(CH,50)],[H(CH,70)],[H(CH,50)],[H(SD,120)],[H(CH,50)],[H(CH,70)],[H(CH,50)]],
    [[H(BD,100),H(CH,70)],[H(CH,50)],[H(CH,70)],[H(CH,50)],[H(SD,100),H(CH,70)],[H(CH,50)],[H(CH,70)],[H(CH,50)],[H(BD,100),H(CH,70)],[H(CH,50)],[H(CH,70)],[H(CH,50)],[H(SD,100),H(OH,80)],[],[H(CH,70)],[]],
    [[H(BD,110)],[],[],[],[H(SD,110)],[],[],[],[H(BD,110)],[],[H(BD,80)],[],[H(SD,110)],[],[],[]],
    [[H(BD,100),H(CH,80)],[H(CH,60)],[H(CH,80)],[H(CH,60)],[H(SD,100),H(OH,80)],[],[H(CH,80)],[H(CH,60)],[H(BD,100),H(CH,80)],[H(CH,60)],[H(CH,80)],[H(CH,60)],[H(SD,100),H(OH,80)],[],[H(CH,80)],[H(CH,60)]],
    [[H(BD,120),H(CH,70)],[H(CH,40)],[H(CH,60)],[H(CH,40)],[H(CP,120),H(CH,70)],[H(CH,40)],[H(CH,60)],[H(CH,40)],[H(BD,120),H(CH,70)],[H(CH,40)],[H(CH,60)],[H(CH,40)],[H(CP,120),H(CH,70)],[H(CH,40)],[H(CH,60)],[H(CH,40)]],
    [[H(BD,110),H(CH,70)],[H(CH,50)],[H(CH,70)],[H(CH,50)],[H(SD,100),H(CH,70)],[H(CH,50)],[H(CH,70)],[H(CH,50)],[H(BD,100),H(CH,70)],[H(CH,50)],[H(BD,90),H(CH,70)],[H(CH,50)],[H(SD,100),H(CH,70)],[H(CH,50)],[H(CH,70)],[H(CH,50)]],
    [[H(BD,110)],[H(CH,60)],[H(CH,80)],[H(CH,60)],[H(SD,110)],[H(CH,60)],[H(CH,80)],[H(CH,60)],[H(BD,100)],[H(CH,60)],[H(CH,80)],[H(CH,60)],[H(SD,110)],[H(CH,60)],[H(SD,80)],[H(SD,70)]],
    [[H(BD,110),H(RD,60)],[],[H(RD,50)],[],[H(SD,100),H(RD,60)],[],[H(RD,50)],[],[H(BD,110),H(RD,60)],[],[H(RD,50)],[],[H(SD,100),H(RD,60)],[],[H(RD,50)],[]],
    [[H(BD,120),H(CH,70)],[H(CH,50)],[H(CH,70)],[H(CH,50)],[H(SD,120),H(CH,70)],[H(CH,50)],[H(CH,70)],[H(CH,50)],[H(BD,120),H(CH,70)],[H(CH,50)],[H(CH,70)],[H(BD,80)],[H(SD,120),H(CH,70)],[H(CH,50)],[H(CH,70)],[H(CH,50)]],
    [[H(BD,110),H(CH,80)],[H(CH,60)],[H(BD,90),H(CH,80)],[H(CH,60)],[H(SD,110),H(CH,80)],[H(CH,60)],[H(CH,80)],[H(CH,60)],[H(BD,110),H(CH,80)],[H(CH,60)],[H(CH,80)],[H(CH,60)],[H(SD,110),H(OH,90)],[],[H(CH,80)],[H(CH,60)]],
]

SYNTHWAVE_BASS = [
    # 1. Octave Bounce — classic New Order style
    [N(0), N(-12), N(0), N(-12), N(0), N(-12), N(0), N(-12), N(0), N(-12), N(0), N(-12), N(0), N(-12), N(0), N(-12)],
    # 2. Driving Root
    [N(0), R, N(0), R, N(0), R, N(0), R, N(0), R, N(0), R, N(0), R, N(0), R],
    # 3. Synth Bass Line — melodic
    [N(0), R, N(0), N(3), N(5), R, N(3), R, N(0), R, N(0), N(3), N(5), R, N(7), R],
    # 4. Pulsing — 1/8 notes with velocity variation
    [N(0,1.0), N(0,0.6), N(0,1.0), N(0,0.6), N(0,1.0), N(0,0.6), N(0,1.0), N(0,0.6), N(5,1.0), N(5,0.6), N(5,1.0), N(5,0.6), N(3,1.0), N(3,0.6), N(3,1.0), N(3,0.6)],
    # 5. Power Bass — root and fifth
    [N(0), R, R, R, N(7), R, R, R, N(0), R, R, R, N(7), R, R, R],
    # 6-20: more
    [N(0), R, N(0), R, N(5), R, N(5), R, N(3), R, N(3), R, N(0), R, N(0), R],
    [N(0), N(0), R, N(0), R, R, N(5), R, N(0), N(0), R, N(0), R, R, N(3), R],
    [N(0,1.0), R, R, R, R, R, R, R, N(5,1.0), R, R, R, R, R, R, R],
    [N(0), R, N(-12), R, N(0), R, N(3), R, N(5), R, N(3), R, N(0), R, N(-12), R],
    [N(0), N(0), N(0), N(0), N(5), N(5), N(5), N(5), N(3), N(3), N(3), N(3), N(0), N(0), N(0), N(0)],
    [N(0,1.2), R, N(0,0.7), R, R, R, N(0,0.7), R, N(5,1.2), R, N(5,0.7), R, R, R, N(5,0.7), R],
    [N(0), R, R, N(0), R, R, N(3), R, R, N(5), R, R, N(7), R, R, R],
    [N(0), N(-12), N(0), R, N(5), N(-7), N(5), R, N(3), N(-9), N(3), R, N(0), N(-12), N(0), R],
    [N(0,1.0), R, N(0,0.7), N(0,0.7), R, R, N(5,1.0), R, N(5,0.7), N(5,0.7), R, R, N(3,1.0), R, N(3,0.7), R],
    [N(0), R, R, R, N(0), R, R, R, N(3), R, R, R, N(5), R, R, R],
    [N(0), R, N(0), R, N(0), R, N(3), R, N(3), R, N(5), R, N(5), R, N(7), R],
    [N(0,1.3), R, R, R, R, R, R, N(-5,1.0), N(0,1.3), R, R, R, R, R, R, R],
    [N(0), N(-12), R, N(0), N(-12), R, N(0), N(-12), N(5), N(-7), R, N(5), N(-7), R, N(5), N(-7)],
    [N(0), R, R, R, R, R, N(5), R, N(0), R, R, R, R, R, N(3), R],
    [N(0,1.0), N(0,0.5), N(0,1.0), N(0,0.5), N(5,1.0), N(5,0.5), N(5,1.0), N(5,0.5), N(3,1.0), N(3,0.5), N(3,1.0), N(3,0.5), N(0,1.0), N(0,0.5), N(0,1.0), N(0,0.5)],
]


# ═══════════════════════════════════════════════════════════════════════════
#  DEEP HOUSE — 122 BPM, four-on-floor, smooth, soulful
#  Muted kick, snare/clap 2+4, open hats on offbeats, 1/16 hats
# ═══════════════════════════════════════════════════════════════════════════

DEEPHOUSE_SYNTH = [
    # 1. Organ Stab — offbeat chords
    [R, R, N(0,1.0), R, R, R, N(0,0.8), R, R, R, N(0,1.0), R, R, R, N(0,0.8), R],
    # 2. Warm Pad — sustained
    [N(0,0.7), R, R, R, R, R, R, R, N(5,0.6), R, R, R, R, R, R, R],
    # 3. Vocal Chop Feel — rhythmic
    [N(0), R, N(3), R, R, N(5), R, R, N(7), R, N(5), R, R, N(3), R, R],
    # 4. Rhodes — jazz voicing
    [N(0), R, R, R, N(4), R, R, R, N(7), R, R, R, N(11), R, R, R],
    # 5. Smooth Lead — flowing
    [N(0), R, N(3), N(5), R, N(7), R, N(5), N(3), R, N(0), R, R, R, R, R],
    # 6-20: more
    [R, N(0,0.9), R, N(0,0.7), R, R, R, N(0,0.9), R, N(0,0.7), R, R, R, R, R, R],
    [N(0,0.8), R, R, R, R, R, R, R, R, R, R, R, N(3,0.7), R, R, R],
    [N(0), N(4), N(7), R, R, R, R, R, N(5), N(9), N(12), R, R, R, R, R],
    [R, R, N(0), R, R, R, R, R, R, R, N(5), R, R, R, R, R],
    [N(0), R, R, N(3), R, R, N(7), R, R, N(5), R, R, N(3), R, R, R],
    [N(0,0.7), R, R, R, R, R, R, R, N(7,0.6), R, R, R, R, R, R, R],
    [R, N(0,1.0), R, R, R, N(3,0.9), R, R, R, N(7,1.0), R, R, R, N(5,0.9), R, R],
    [N(0), R, N(5), R, N(7), R, N(12), R, N(7), R, N(5), R, N(0), R, R, R],
    [N(0,0.8), R, R, R, N(0,0.8), R, R, R, N(5,0.7), R, R, R, N(3,0.7), R, R, R],
    [N(0), R, R, R, R, R, N(7), R, R, R, R, R, N(5), R, R, R],
    [R, R, R, N(0), R, R, R, N(4), R, R, R, N(7), R, R, R, R],
    [N(0,0.6), R, R, R, R, R, R, R, R, R, R, R, R, R, R, R],
    [N(0), R, N(3), R, N(5), R, N(7), R, N(10), R, N(12), R, N(10), R, N(7), R],
    [R, N(0,0.9), R, R, R, R, N(0,0.9), R, R, R, R, R, R, R, R, R],
    [N(0), R, R, R, N(7), R, R, R, N(12), R, R, R, N(7), R, R, R],
]

DEEPHOUSE_DRUMS = [
    # 1. Classic Deep — four-on-floor + offbeat hats
    [[H(BD,100),H(CH,70)],[H(CH,50)],[H(CH,70),H(OH,60)],[H(CH,50)],[H(BD,100),H(CP,90),H(CH,70)],[H(CH,50)],[H(CH,70),H(OH,60)],[H(CH,50)],[H(BD,100),H(CH,70)],[H(CH,50)],[H(CH,70),H(OH,60)],[H(CH,50)],[H(BD,100),H(CP,90),H(CH,70)],[H(CH,50)],[H(CH,70),H(OH,60)],[H(CH,50)]],
    # 2. Minimal Deep
    [[H(BD,90)],[H(CH,40)],[H(CH,60)],[H(CH,40)],[H(BD,90),H(CP,80)],[H(CH,40)],[H(CH,60)],[H(CH,40)],[H(BD,90)],[H(CH,40)],[H(CH,60)],[H(CH,40)],[H(BD,90),H(CP,80)],[H(CH,40)],[H(CH,60)],[H(CH,40)]],
    # 3. Ride Deep — ride cymbal groove
    [[H(BD,95),H(RD,60)],[H(RD,40)],[H(RD,60)],[H(RD,40)],[H(BD,95),H(SD,85),H(RD,60)],[H(RD,40)],[H(RD,60)],[H(RD,40)],[H(BD,95),H(RD,60)],[H(RD,40)],[H(RD,60)],[H(RD,40)],[H(BD,95),H(SD,85),H(RD,60)],[H(RD,40)],[H(RD,60)],[H(RD,40)]],
    # 4. Shuffle — swung hats
    [[H(BD,95),H(CH,70)],[],[H(CH,50)],[H(CH,70)],[H(BD,95),H(CP,85)],[],[H(CH,50)],[H(CH,70)],[H(BD,95),H(CH,70)],[],[H(CH,50)],[H(CH,70)],[H(BD,95),H(CP,85)],[],[H(CH,50)],[H(CH,70)]],
    # 5. Open Hat Groove
    [[H(BD,100)],[H(CH,50)],[H(OH,70)],[H(CH,50)],[H(BD,100),H(CP,90)],[H(CH,50)],[H(OH,70)],[H(CH,50)],[H(BD,100)],[H(CH,50)],[H(OH,70)],[H(CH,50)],[H(BD,100),H(CP,90)],[H(CH,50)],[H(OH,70)],[H(CH,50)]],
    # 6-20: variations
    [[H(BD,90),H(CH,60)],[H(CH,40)],[H(CH,60)],[H(CH,40)],[H(BD,90),H(SD,80),H(CH,60)],[H(CH,40)],[H(CH,60)],[H(CH,40)],[H(BD,90),H(CH,60)],[H(CH,40)],[H(CH,60)],[H(CH,40)],[H(BD,90),H(SD,80),H(CH,60)],[H(CH,40)],[H(CH,60)],[H(CH,40)]],
    [[H(BD,100),H(CH,70)],[H(CH,50)],[H(CH,70)],[H(CH,50)],[H(CP,90),H(CH,70)],[H(CH,50)],[H(CH,70)],[H(CH,50)],[H(BD,100),H(CH,70)],[H(CH,50)],[H(CH,70)],[H(CH,50)],[H(CP,90),H(CH,70)],[H(CH,50)],[H(OH,80)],[H(CH,50)]],
    [[H(BD,95)],[H(CH,45)],[H(CH,65)],[H(CH,45)],[H(BD,95),H(CP,85)],[H(CH,45)],[H(CH,65)],[H(CH,45)],[H(BD,95)],[H(CH,45)],[H(BD,75),H(CH,65)],[H(CH,45)],[H(BD,95),H(CP,85)],[H(CH,45)],[H(CH,65)],[H(CH,45)]],
    [[H(BD,100),H(RD,55)],[],[H(RD,45)],[],[H(BD,100),H(CP,90),H(RD,55)],[],[H(RD,45)],[],[H(BD,100),H(RD,55)],[],[H(RD,45)],[],[H(BD,100),H(CP,90),H(RD,55)],[],[H(RD,45)],[]],
    [[H(BD,90),H(CH,70)],[H(CH,50)],[H(OH,65)],[H(CH,50)],[H(BD,90),H(SD,80),H(CH,70)],[H(CH,50)],[H(OH,65)],[H(CH,50)],[H(BD,90),H(CH,70)],[H(CH,50)],[H(OH,65)],[H(CH,50)],[H(BD,90),H(SD,80),H(CH,70)],[H(CH,50)],[H(OH,65)],[H(CH,50)]],
    [[H(BD,95),H(CH,60)],[H(CH,40)],[H(CH,60)],[H(CH,40)],[H(BD,95),H(CP,85),H(CH,60)],[H(CH,40)],[H(CH,60)],[H(CH,40)],[H(BD,95),H(CH,60)],[H(CH,40)],[H(CH,60)],[H(CH,40)],[H(BD,95),H(CP,85),H(CH,60)],[H(CH,40)],[H(CH,60)],[H(CH,40)]],
    [[H(BD,100)],[],[H(CH,55)],[],[H(CP,90)],[],[H(CH,55)],[],[H(BD,100)],[],[H(CH,55)],[],[H(CP,90)],[],[H(CH,55)],[]],
    [[H(BD,90),H(CH,70)],[H(CH,50)],[H(CH,70)],[H(CH,50)],[H(SD,80),H(CH,70)],[H(CH,50)],[H(CH,70)],[H(CH,50)],[H(BD,90),H(CH,70)],[H(CH,50)],[H(CH,70)],[H(CH,50)],[H(SD,80),H(OH,80)],[],[H(CH,70)],[H(CH,50)]],
    [[H(BD,95),H(CH,60)],[H(CH,40)],[H(OH,60)],[H(CH,40)],[H(BD,95),H(CP,85),H(CH,60)],[H(CH,40)],[H(OH,60)],[H(CH,40)],[H(BD,95),H(CH,60)],[H(CH,40)],[H(OH,60)],[H(CH,40)],[H(BD,95),H(CP,85),H(CH,60)],[H(CH,40)],[H(OH,60)],[H(CH,40)]],
    [[H(BD,100),H(CH,65)],[H(CH,45)],[H(CH,65)],[H(CH,45)],[H(BD,100),H(CP,90),H(CH,65)],[H(CH,45)],[H(CH,65)],[H(CH,45)],[H(BD,100),H(CH,65)],[H(CH,45)],[H(CH,65)],[H(CH,45)],[H(BD,100),H(CP,90),H(CH,65)],[H(CH,45)],[H(CH,65)],[H(BD,80)]],
    [[H(BD,90),H(RD,55)],[H(RD,35)],[H(RD,55)],[H(RD,35)],[H(BD,90),H(SD,80),H(RD,55)],[H(RD,35)],[H(RD,55)],[H(RD,35)],[H(BD,90),H(RD,55)],[H(RD,35)],[H(RD,55)],[H(RD,35)],[H(BD,90),H(SD,80),H(RD,55)],[H(RD,35)],[H(RD,55)],[H(RD,35)]],
    [[H(BD,95),H(CH,70)],[H(CH,50)],[H(CH,70)],[H(CH,50)],[H(CP,85),H(CH,70)],[H(CH,50)],[H(CH,70)],[H(CH,50)],[H(BD,95),H(CH,70)],[H(CH,50)],[H(BD,75),H(CH,70)],[H(CH,50)],[H(CP,85),H(CH,70)],[H(CH,50)],[H(CH,70)],[H(CH,50)]],
    [[H(BD,100)],[H(CH,50)],[H(CH,70)],[H(CH,50)],[H(BD,100),H(CP,90)],[H(CH,50)],[H(CH,70)],[H(CH,50)],[H(BD,100)],[H(CH,50)],[H(CH,70)],[H(CH,50)],[H(BD,100),H(CP,90)],[H(CH,50)],[H(CH,70)],[H(RS,60)]],
    [[H(BD,95),H(OH,60)],[],[H(CH,50)],[],[H(BD,95),H(CP,85),H(OH,60)],[],[H(CH,50)],[],[H(BD,95),H(OH,60)],[],[H(CH,50)],[],[H(BD,95),H(CP,85),H(OH,60)],[],[H(CH,50)],[]],
]

DEEPHOUSE_BASS = [
    # 1. Smooth Root — simple and deep
    [N(0), R, R, R, N(0), R, R, R, N(0), R, R, R, N(0), R, R, R],
    # 2. Melodic Line — flowing
    [N(0), R, N(3), R, N(5), R, N(7), R, N(5), R, N(3), R, N(0), R, R, R],
    # 3. Offbeat Pulse
    [R, N(0), R, N(0), R, N(0), R, N(0), R, N(0), R, N(0), R, N(0), R, N(0)],
    # 4. Chord Tones — root-3rd-5th
    [N(0), R, R, R, N(4), R, R, R, N(7), R, R, R, N(4), R, R, R],
    # 5. Walking Groove
    [N(0), R, N(2), R, N(3), R, N(5), R, N(7), R, N(5), R, N(3), R, N(2), R],
    # 6-20
    [N(0,1.0), R, R, R, R, R, R, R, N(5,0.8), R, R, R, R, R, R, R],
    [N(0), R, N(0), R, R, R, N(5), R, N(0), R, N(0), R, R, R, N(3), R],
    [N(0), R, R, N(3), R, R, N(5), R, R, N(3), R, R, N(0), R, R, R],
    [N(0,0.9), R, R, R, N(0,0.9), R, R, R, N(7,0.8), R, R, R, N(5,0.8), R, R, R],
    [R, N(0), R, R, R, N(0), R, R, R, N(5), R, R, R, N(3), R, R],
    [N(0), R, N(3), R, N(5), R, R, R, N(7), R, N(5), R, N(3), R, R, R],
    [N(0), R, R, R, R, R, R, R, N(0), R, R, R, N(-5), R, R, R],
    [N(0,1.0), R, N(0,0.6), R, N(5,1.0), R, N(5,0.6), R, N(3,1.0), R, N(3,0.6), R, N(0,1.0), R, N(0,0.6), R],
    [N(0), R, R, R, N(3), R, R, R, N(0), R, R, R, N(7), R, R, R],
    [N(0), R, R, R, R, R, N(0), R, R, R, R, R, N(5), R, R, R],
    [N(0), R, N(7), R, R, R, N(5), R, N(0), R, N(3), R, R, R, N(0), R],
    [N(0,0.8), R, R, R, R, R, R, R, R, R, R, R, R, R, R, R],
    [N(0), R, N(0), R, N(3), R, N(3), R, N(5), R, N(5), R, N(7), R, N(7), R],
    [N(0), R, R, R, N(0), R, R, R, N(-5), R, R, R, N(0), R, R, R],
    [N(0,1.0), R, R, N(0,0.6), R, R, N(5,0.9), R, R, N(5,0.6), R, R, N(3,0.9), R, R, R],
]


# ═══════════════════════════════════════════════════════════════════════════
#  PSYTRANCE — 145 BPM, driving, hypnotic, rolling basslines
#  Kick every beat, minimal snare, KBBB bass pattern (kick+3 bass per beat)
# ═══════════════════════════════════════════════════════════════════════════

PSYTRANCE_SYNTH = [
    # 1. Acid Lead — 303-style
    [N(0), N(3), N(7), N(12), N(7), N(3), N(0), N(-5), N(0), N(3), N(7), N(12), N(7), N(3), N(0), N(-5)],
    # 2. Atmospheric — sparse pads
    [N(0,0.7), R, R, R, R, R, R, R, R, R, R, R, R, R, R, R],
    # 3. Trance Gate — rhythmic pad
    [N(0), R, N(0,0.6), R, N(0), R, N(0,0.6), R, N(0), R, N(0,0.6), R, N(0), R, N(0,0.6), R],
    # 4. Alien FX — weird intervals
    [N(0), R, N(6), R, N(1), R, N(7), R, N(2), R, N(8), R, N(3), R, N(9), R],
    # 5. Rising Tension — chromatic
    [N(0), N(1), N(2), N(3), N(4), N(5), N(6), N(7), N(8), N(9), N(10), N(11), N(12), N(11), N(10), N(9)],
    # 6. Arp Cycle — up-down
    [N(0), N(3), N(7), N(12), N(15), N(12), N(7), N(3), N(0), N(3), N(7), N(12), N(15), N(12), N(7), N(3)],
    # 7. Psy Melody — minor scale
    [N(0), R, N(3), R, N(5), R, N(7), R, N(8), R, N(7), R, N(5), R, N(3), R],
    # 8. Staccato — rapid stabs
    [N(0), N(0), R, N(0), R, R, N(7), N(7), R, N(7), R, R, N(0), N(0), R, R],
    # 9. Hypnotic — one note, velocity variation
    [N(0,1.2), N(0,0.6), N(0,0.8), N(0,0.6), N(0,1.2), N(0,0.6), N(0,0.8), N(0,0.6), N(0,1.2), N(0,0.6), N(0,0.8), N(0,0.6), N(0,1.2), N(0,0.6), N(0,0.8), N(0,0.6)],
    # 10. Wide Intervals — octave jumps
    [N(0), R, N(12), R, N(0), R, N(12), R, N(7), R, N(19), R, N(7), R, N(19), R],
    [N(0), N(5), N(7), R, N(0), N(5), N(7), R, N(3), N(7), N(10), R, N(3), N(7), N(10), R],
    [N(0,0.8), R, R, R, R, R, R, R, N(5,0.7), R, R, R, R, R, R, R],
    [N(0), R, N(7), R, N(5), R, N(0), R, N(7), R, N(5), R, N(0), R, N(7), R],
    [N(0), N(0), N(3), N(3), N(7), N(7), N(3), N(3), N(0), N(0), N(3), N(3), N(7), N(7), N(3), N(3)],
    [N(0), R, N(1), R, N(0), R, N(-1), R, N(0), R, N(1), R, N(0), R, N(-1), R],
    [N(0), N(3), N(5), N(7), N(10), N(12), N(10), N(7), N(5), N(3), N(0), N(-2), N(-5), N(-2), N(0), N(3)],
    [R, N(0), R, R, R, N(7), R, R, R, N(12), R, R, R, N(7), R, R],
    [N(0,1.0), N(0,0.5), N(0,1.0), N(0,0.5), N(7,1.0), N(7,0.5), N(7,1.0), N(7,0.5), N(5,1.0), N(5,0.5), N(5,1.0), N(5,0.5), N(3,1.0), N(3,0.5), N(3,1.0), N(3,0.5)],
    [N(0), N(3), N(7), N(10), N(0), N(3), N(7), N(10), N(0), N(3), N(7), N(10), N(0), N(3), N(7), N(10)],
    [N(0), R, N(0), R, N(0), R, N(5), R, N(5), R, N(5), R, N(7), R, N(7), R],
]

PSYTRANCE_DRUMS = [
    # 1. Classic Psy — kick every beat, minimal hats
    [[H(BD,120)],[H(CH,50)],[H(CH,70)],[H(CH,50)],[H(BD,120)],[H(CH,50)],[H(CH,70)],[H(CH,50)],[H(BD,120)],[H(CH,50)],[H(CH,70)],[H(CH,50)],[H(BD,120)],[H(CH,50)],[H(CH,70)],[H(CH,50)]],
    # 2. Driving — kick every beat, open hat on offbeat
    [[H(BD,120),H(CH,60)],[H(CH,40)],[H(OH,50)],[H(CH,40)],[H(BD,120),H(CH,60)],[H(CH,40)],[H(OH,50)],[H(CH,40)],[H(BD,120),H(CH,60)],[H(CH,40)],[H(OH,50)],[H(CH,40)],[H(BD,120),H(CH,60)],[H(CH,40)],[H(OH,50)],[H(CH,40)]],
    # 3. Snare on 3 — builds tension
    [[H(BD,120),H(CH,60)],[H(CH,40)],[H(CH,60)],[H(CH,40)],[H(BD,120),H(CH,60)],[H(CH,40)],[H(CH,60)],[H(CH,40)],[H(BD,120),H(SD,80),H(CH,60)],[H(CH,40)],[H(CH,60)],[H(CH,40)],[H(BD,120),H(CH,60)],[H(CH,40)],[H(CH,60)],[H(CH,40)]],
    # 4. Sparse — just kicks
    [[H(BD,127)],[],[],[],[H(BD,127)],[],[],[],[H(BD,127)],[],[],[],[H(BD,127)],[],[],[]],
    # 5. Clap Accent
    [[H(BD,120),H(CH,60)],[H(CH,40)],[H(CH,60)],[H(CH,40)],[H(BD,120),H(CP,90),H(CH,60)],[H(CH,40)],[H(CH,60)],[H(CH,40)],[H(BD,120),H(CH,60)],[H(CH,40)],[H(CH,60)],[H(CH,40)],[H(BD,120),H(CP,90),H(CH,60)],[H(CH,40)],[H(CH,60)],[H(CH,40)]],
    # 6-20: variations
    [[H(BD,120)],[H(CH,50)],[H(CH,70)],[H(CH,50)],[H(BD,120)],[H(CH,50)],[H(CH,70)],[H(CH,50)],[H(BD,120)],[H(CH,50)],[H(CH,70)],[H(CH,50)],[H(BD,120)],[H(CH,50)],[H(OH,70)],[]],
    [[H(BD,120),H(CH,70)],[H(CH,40)],[H(CH,60)],[H(CH,40)],[H(BD,120),H(CH,70)],[H(CH,40)],[H(CH,60)],[H(CH,40)],[H(BD,120),H(CH,70)],[H(CH,40)],[H(CH,60)],[H(CH,40)],[H(BD,120),H(CH,70)],[H(CH,40)],[H(CH,60)],[H(CH,40)]],
    [[H(BD,127),H(CH,60)],[H(CH,40)],[H(CH,60)],[H(CH,40)],[H(BD,127),H(CH,60)],[H(CH,40)],[H(CH,60)],[H(CH,40)],[H(BD,127),H(CP,80),H(CH,60)],[H(CH,40)],[H(CH,60)],[H(CH,40)],[H(BD,127),H(CH,60)],[H(CH,40)],[H(CH,60)],[H(CH,40)]],
    [[H(BD,120)],[],[H(CH,60)],[],[H(BD,120)],[],[H(CH,60)],[],[H(BD,120)],[],[H(CH,60)],[],[H(BD,120)],[],[H(CH,60)],[]],
    [[H(BD,120),H(RD,50)],[H(RD,30)],[H(RD,50)],[H(RD,30)],[H(BD,120),H(RD,50)],[H(RD,30)],[H(RD,50)],[H(RD,30)],[H(BD,120),H(RD,50)],[H(RD,30)],[H(RD,50)],[H(RD,30)],[H(BD,120),H(RD,50)],[H(RD,30)],[H(RD,50)],[H(RD,30)]],
    [[H(BD,120),H(CH,60)],[H(CH,40)],[H(OH,55)],[H(CH,40)],[H(BD,120),H(CH,60)],[H(CH,40)],[H(OH,55)],[H(CH,40)],[H(BD,120),H(CH,60)],[H(CH,40)],[H(OH,55)],[H(CH,40)],[H(BD,120),H(CH,60)],[H(CH,40)],[H(OH,55)],[H(CH,40)]],
    [[H(BD,127)],[H(CH,50)],[H(CH,70)],[H(CH,50)],[H(BD,127)],[H(CH,50)],[H(CH,70)],[H(CH,50)],[H(BD,127)],[H(CH,50)],[H(CH,70)],[H(CH,50)],[H(BD,127)],[H(CH,50)],[H(CH,70)],[H(CH,50)]],
    [[H(BD,120),H(CH,70)],[H(CH,50)],[H(CH,70)],[H(CH,50)],[H(BD,120),H(CH,70)],[H(CH,50)],[H(CH,70)],[H(CH,50)],[H(BD,120),H(SD,70),H(CH,70)],[H(CH,50)],[H(CH,70)],[H(CH,50)],[H(BD,120),H(CH,70)],[H(CH,50)],[H(CH,70)],[H(CH,50)]],
    [[H(BD,120)],[H(CH,40)],[H(CH,60)],[H(CH,40)],[H(BD,120)],[H(CH,40)],[H(CH,60)],[H(CH,40)],[H(BD,120)],[H(CH,40)],[H(CH,60)],[H(CH,40)],[H(BD,120)],[H(CH,40)],[H(OH,70)],[H(CH,40)]],
    [[H(BD,127),H(CH,60)],[H(CH,40)],[H(CH,60)],[H(CH,40)],[H(BD,127),H(CP,85),H(CH,60)],[H(CH,40)],[H(CH,60)],[H(CH,40)],[H(BD,127),H(CH,60)],[H(CH,40)],[H(CH,60)],[H(CH,40)],[H(BD,127),H(CP,85),H(CH,60)],[H(CH,40)],[H(CH,60)],[H(CH,40)]],
    [[H(BD,120),H(CH,60)],[H(CH,40)],[H(CH,60)],[H(CH,40)],[H(BD,120),H(CH,60)],[H(CH,40)],[H(CH,60)],[H(CH,40)],[H(BD,120),H(CH,60)],[H(CH,40)],[H(CH,60)],[H(CH,40)],[H(BD,120),H(CH,60)],[H(CH,40)],[H(SD,60)],[H(SD,50)]],
    [[H(BD,120)],[H(CH,55)],[H(CH,70)],[H(CH,55)],[H(BD,120)],[H(CH,55)],[H(CH,70)],[H(CH,55)],[H(BD,120)],[H(CH,55)],[H(CH,70)],[H(CH,55)],[H(BD,120)],[H(CH,55)],[H(CH,70)],[H(CH,55)]],
    [[H(BD,127),H(OH,60)],[],[H(CH,50)],[],[H(BD,127),H(OH,60)],[],[H(CH,50)],[],[H(BD,127),H(OH,60)],[],[H(CH,50)],[],[H(BD,127),H(OH,60)],[],[H(CH,50)],[]],
    [[H(BD,120),H(CH,65)],[H(CH,45)],[H(CH,65)],[H(CH,45)],[H(BD,120),H(CH,65)],[H(CH,45)],[H(CH,65)],[H(CH,45)],[H(BD,120),H(CH,65)],[H(CH,45)],[H(CH,65)],[H(CH,45)],[H(BD,120),H(CH,65)],[H(CH,45)],[H(OH,70)],[H(CH,45)]],
]

PSYTRANCE_BASS = [
    # 1. KBBB — classic psytrance: kick + 3 bass notes per beat
    [N(0), N(0), N(0), R, N(0), N(0), N(0), R, N(0), N(0), N(0), R, N(0), N(0), N(0), R],
    # 2. Rolling 16ths — constant drive
    [N(0), N(0), N(0), N(0), N(0), N(0), N(0), N(0), N(0), N(0), N(0), N(0), N(0), N(0), N(0), N(0)],
    # 3. Octave Bounce — root and octave
    [N(0), N(-12), N(0), R, N(0), N(-12), N(0), R, N(0), N(-12), N(0), R, N(0), N(-12), N(0), R],
    # 4. Minor Scale Run
    [N(0), N(3), N(5), R, N(0), N(3), N(5), R, N(0), N(3), N(5), R, N(0), N(3), N(5), R],
    # 5. Chromatic Slide
    [N(0), N(1), N(0), R, N(0), N(1), N(0), R, N(0), N(1), N(0), R, N(0), N(1), N(0), R],
    # 6-20
    [N(0), N(0), N(0), N(3), N(0), N(0), N(0), N(5), N(0), N(0), N(0), N(3), N(0), N(0), N(0), N(5)],
    [N(0), N(0), R, N(0), N(0), N(0), R, N(0), N(0), N(0), R, N(0), N(0), N(0), R, N(0)],
    [N(0), N(3), N(0), N(-2), N(0), N(3), N(0), N(-2), N(0), N(3), N(0), N(-2), N(0), N(3), N(0), N(-2)],
    [N(0), N(0), N(0), R, N(5), N(5), N(5), R, N(0), N(0), N(0), R, N(3), N(3), N(3), R],
    [N(0), N(-12), N(0), N(3), N(0), N(-12), N(0), N(5), N(0), N(-12), N(0), N(3), N(0), N(-12), N(0), N(5)],
    [N(0), N(0), N(0), N(0), N(5), N(5), N(5), N(5), N(3), N(3), N(3), N(3), N(0), N(0), N(0), N(0)],
    [N(0), N(0), N(3), R, N(0), N(0), N(5), R, N(0), N(0), N(7), R, N(0), N(0), N(5), R],
    [N(0), N(0), N(-1), N(0), N(0), N(0), N(-1), N(0), N(0), N(0), N(-1), N(0), N(0), N(0), N(-1), N(0)],
    [N(0), R, N(0), N(0), N(0), R, N(0), N(0), N(0), R, N(0), N(0), N(0), R, N(0), N(0)],
    [N(0), N(3), N(5), N(7), N(5), N(3), N(0), R, N(0), N(3), N(5), N(7), N(5), N(3), N(0), R],
    [N(0), N(0), N(0), N(-5), N(0), N(0), N(0), N(-5), N(0), N(0), N(0), N(-5), N(0), N(0), N(0), N(-5)],
    [N(0), N(0), N(0), R, N(0), N(0), N(0), R, N(5), N(5), N(5), R, N(3), N(3), N(3), R],
    [N(0), N(-12), N(-12), R, N(0), N(-12), N(-12), R, N(0), N(-12), N(-12), R, N(0), N(-12), N(-12), R],
    [N(0), N(0), N(3), N(0), N(5), N(0), N(3), N(0), N(0), N(0), N(3), N(0), N(5), N(0), N(3), N(0)],
    [N(0), N(0), N(0), N(0), R, N(0), N(0), N(0), N(0), R, N(0), N(0), N(0), N(0), R, R],
]


# ═══════════════════════════════════════════════════════════════════════════
#  Pattern metadata (names + descriptions)
# ═══════════════════════════════════════════════════════════════════════════

PATTERN_META = {
    "dubstep": {
        "synth": [
            ("Dark Atmosphere", "sparse minor stabs over half-time drums"),
            ("Melodic Drift", "slow evolving minor scale melody"),
            ("Stab Rhythm", "syncopated chord hits with space"),
            ("Octave Drops", "dramatic pitch movement between octaves"),
            ("Tension Build", "chromatic rise building intensity"),
            ("Void", "minimal pad hits with maximum space"),
            ("Broken Chords", "arpeggiated minor triad pattern"),
            ("Sub Drone", "root note with occasional subtle movement"),
            ("Glitch Stutter", "rapid repeats followed by silence"),
            ("Cinematic", "wide intervals for dramatic effect"),
            ("Half-time Groove", "heavy accented downbeats"),
            ("Minor Cascade", "descending minor scale run"),
            ("Sparse Melody", "breathing melody with space"),
            ("Power Chord", "root and fifth stabs"),
            ("Wobble Rhythm", "synced with bass wobble LFO"),
            ("Ambient Texture", "slow pad for atmosphere"),
            ("Tritone Tension", "dissonant b5 interval"),
            ("Call and Response", "phrase then answer"),
            ("Minimal Pulse", "subtle rhythmic root notes"),
            ("Reese Stab", "sliding reese bass stabs"),
        ],
        "drums": [
            ("Classic Half-Time", "kick 1 snare 3 — the dubstep standard"),
            ("Sparse Kick Snare", "minimal — just kick and snare"),
            ("Broken", "syncopated kick pattern"),
            ("Heavy", "sub-heavy kick with clap on 3"),
            ("Triplet Hats", "swing feel with triplet hi-hats"),
            ("Rim Pattern", "rimshot accents between hits"),
            ("Open Hat Groove", "open hat for width"),
            ("Double Kick", "two kicks before the snare"),
            ("Ride Groove", "ride cymbal instead of hats"),
            ("Snare Roll Fill", "building snare roll"),
            ("Clap Heavy", "clap emphasis on half-time"),
            ("Syncopated", "off-grid kick placement"),
            ("Dark Ride", "ride cymbal with space"),
            ("16th Hats", "constant hat momentum"),
            ("Kick Snare Clap", "layered snare and clap"),
            ("Sparse Hats", "minimal hat pattern"),
            ("Rimshot Groove", "rimshot as rhythmic anchor"),
            ("Open Space", "kick and clap with room"),
            ("Ghost Notes", "quiet hat fills"),
            ("Rolling", "building momentum pattern"),
        ],
        "bass": [
            ("Sub Root", "sustained deep sub bass"),
            ("Wobble", "classic wobble bass rhythm"),
            ("Drop Pattern", "octave drop impact"),
            ("Syncopated Sub", "offbeat sub placement"),
            ("Minor Movement", "bass line with chord tones"),
            ("Pulsing Sub", "rhythmic sub pulse"),
            ("Growl Bass", "chromatic slide growl"),
            ("Sparse Hits", "single heavy sub hit"),
            ("Fifth Drop", "root to fifth movement"),
            ("Stutter Bass", "rapid repeated notes"),
            ("Dark Fifth", "root and flat fifth"),
            ("Ghost Sub", "quiet ghost notes"),
            ("Rising Line", "ascending bass movement"),
            ("Octave Dive", "dramatic octave plunge"),
            ("Slide Down", "portamento bass slides"),
            ("Minimal Root", "simple root with variation"),
            ("Double Hit", "two hits then space"),
            ("Tension Bass", "dissonant approach notes"),
            ("Delayed Drop", "late octave drop"),
            ("Stutter Fill", "rapid fill at bar end"),
        ],
    },
    "lo-fi": {
        "synth": [
            ("Jazz Chord", "7th chord voicing — warm and mellow"),
            ("Mellow Melody", "pentatonic melody — nostalgic"),
            ("Rhodes Stabs", "offbeat Rhodes chord hits"),
            ("Dreamy Pad", "long sustained warm notes"),
            ("Walking Notes", "stepwise chromatic movement"),
            ("Sparse Chords", "breathing room between hits"),
            ("Minor 9th Feel", "extended jazz voicing"),
            ("Rainy Day", "descending melancholy melody"),
            ("Nostalgic Loop", "simple warm loop"),
            ("Late Night", "very sparse atmospheric"),
            ("Major 7th", "bright jazz chord"),
            ("Offbeat Chords", "syncopated placement"),
            ("Simple Triad", "basic chord tones"),
            ("Gentle Motion", "slow moving notes"),
            ("Double Notes", "paired note rhythm"),
            ("Jazz Stabs", "rhythmic chord hits"),
            ("Stepwise", "chromatic approach"),
            ("Falling", "descending gentle line"),
            ("Paired Melody", "call and response within"),
            ("Whisper", "barely there single note"),
        ],
        "drums": [
            ("Classic Boom Bap", "kick 1+3 snare 2+4 — the standard"),
            ("Lazy Groove", "pushed kick for relaxed feel"),
            ("Ride Feel", "ride cymbal instead of hats"),
            ("Minimal", "just kick and snare — bare bones"),
            ("Ghost Notes", "very subtle hat fills"),
            ("Swung", "offbeat swing feel"),
            ("Open Hat Accent", "open hat on snare hits"),
            ("Soft Hats", "gentle closed hat pattern"),
            ("Pushed Kick", "kick anticipating the beat"),
            ("Ride and Kick", "ride cymbal groove"),
            ("Clap Swap", "clap instead of snare"),
            ("Full Ghost", "ghost notes throughout"),
            ("Late Snare", "snare slightly behind the beat"),
            ("Rimshot Feel", "rimshot for lighter texture"),
            ("Double Kick", "two kicks before snare"),
            ("Open Space", "open hat accents for width"),
            ("Hat Fill", "hat fills between hits"),
            ("Clap Light", "light clap pattern"),
            ("Subtle Full", "full but very quiet pattern"),
            ("Ending Kick", "kick at end of bar"),
        ],
        "bass": [
            ("Walking Bass", "stepwise jazz walking line"),
            ("Root Fifth", "simple root and fifth"),
            ("Jazzy Line", "chromatic approach notes"),
            ("Mellow Pulse", "simple sustained root"),
            ("Octave Bounce", "root octave alternation"),
            ("Minor Walk", "minor scale walk"),
            ("Descending", "descending bass movement"),
            ("Sparse Melody", "melodic bass with space"),
            ("Quarter Notes", "steady quarter note pulse"),
            ("Approach Notes", "chromatic approach to root"),
            ("Root and Third", "chord tone bass"),
            ("Deep Root", "single deep root note"),
            ("Paired Notes", "double-hit rhythm"),
            ("Ascending", "rising bass line"),
            ("Gentle Pulse", "soft rhythmic pulse"),
            ("Walking Thirds", "thirds-based walking"),
            ("Simple Return", "out and back to root"),
            ("Fifths", "root to fifth movement"),
            ("Soft Rhythm", "gentle rhythmic variation"),
            ("Ending Note", "resolving bass at bar end"),
        ],
    },
    "synthwave": {
        "synth": [
            ("Arp Up", "classic ascending arpeggio — pure 80s"),
            ("Gated Pad", "sustained pad with rhythmic velocity"),
            ("Power Melody", "heroic 80s theme melody"),
            ("Blade Runner", "moody slow atmospheric"),
            ("Outrun Arp", "descending driving arpeggio"),
            ("Neon Stabs", "offbeat synth chord stabs"),
            ("Synth Lead", "soaring lead melody"),
            ("Chase Scene", "fast repeated urgent notes"),
            ("Sunset Pad", "warm whole note sustain"),
            ("Retrograde", "reverse arpeggio pattern"),
            ("Octave Pulse", "root and octave alternation"),
            ("Triad Arp", "arpeggiated triad pattern"),
            ("Wide Pad", "slow sustained chord"),
            ("Scale Run", "full scale ascending"),
            ("Offbeat Arp", "syncopated arpeggio"),
            ("Stepped", "rising in steps"),
            ("Echo Lead", "doubled note echo feel"),
            ("Octave Jump", "jumping between octaves"),
            ("Wave Motion", "up-down wave pattern"),
            ("Chord Pulse", "rhythmic chord pulses"),
        ],
        "drums": [
            ("Classic 80s", "kick 1+3 snare 2+4 with driving hats"),
            ("Four on Floor", "disco-influenced four-on-floor"),
            ("Big Snare", "gated reverb snare emphasis"),
            ("Tom Fill", "tom-heavy with fills"),
            ("Ride Groove", "ride cymbal groove"),
            ("Clap Drive", "clap instead of snare"),
            ("Open Hats", "open hat width pattern"),
            ("Syncopated", "pushed kick pattern"),
            ("Sparse", "minimal kick and snare"),
            ("Crash Accent", "crash cymbal emphasis"),
            ("Standard", "classic rock-influenced"),
            ("Minimal 80s", "stripped back 80s feel"),
            ("Open Hat Accent", "open hat on offbeats"),
            ("Clap Drive Alt", "clap variation"),
            ("Double Kick", "pushed kick before snare"),
            ("Snare Fill", "snare roll at bar end"),
            ("Ride Alt", "ride cymbal variation"),
            ("Driving 16ths", "constant 16th hats"),
            ("Open Close", "alternating open/close hats"),
            ("Retro Groove", "full retro drum pattern"),
        ],
        "bass": [
            ("Octave Bounce", "classic New Order octave bass"),
            ("Driving Root", "steady eighth note root"),
            ("Synth Bass Line", "melodic bass with movement"),
            ("Pulsing", "velocity variation pulse"),
            ("Power Bass", "root and fifth power"),
            ("Chord Tones", "moving through chord tones"),
            ("Rhythmic", "syncopated bass rhythm"),
            ("Whole Notes", "sustained bass notes"),
            ("Walking Octave", "octave walk with passing tones"),
            ("16th Drive", "constant 16th note drive"),
            ("Accented", "velocity-accented pulse"),
            ("Stepped", "rising bass steps"),
            ("Bounce Alt", "octave bounce variation"),
            ("Dotted", "dotted rhythm pattern"),
            ("Quarter Roots", "simple quarter note roots"),
            ("Scale Bass", "ascending scale bass"),
            ("Deep Drop", "dramatic low drop"),
            ("Double Octave", "fast octave bounce variation"),
            ("Offbeat", "syncopated offbeat placement"),
            ("Pulse Fade", "fading velocity pulse"),
        ],
    },
    "deep-house": {
        "synth": [
            ("Organ Stab", "offbeat organ chord stabs"),
            ("Warm Pad", "sustained warm atmosphere"),
            ("Vocal Chop Feel", "rhythmic melodic pattern"),
            ("Rhodes", "jazz chord voicing"),
            ("Smooth Lead", "flowing melodic line"),
            ("Offbeat Stabs", "syncopated chord hits"),
            ("Deep Pad", "very sparse sustained note"),
            ("Triad Stab", "triad chord rhythmic pattern"),
            ("Minimal Hit", "single note placement"),
            ("Flowing", "stepwise melodic movement"),
            ("Gentle Pad", "soft sustained atmosphere"),
            ("Offbeat Lead", "syncopated melody"),
            ("Scale Run", "ascending scale passage"),
            ("Chord Pulse", "rhythmic chord tones"),
            ("Sparse", "minimal note placement"),
            ("Jazz Voicing", "extended chord approach"),
            ("Whisper Pad", "barely audible atmosphere"),
            ("Pentatonic", "pentatonic scale melody"),
            ("Double Stab", "paired chord hits"),
            ("Wide Interval", "root to octave movement"),
        ],
        "drums": [
            ("Classic Deep", "four-on-floor with offbeat hats"),
            ("Minimal Deep", "stripped back groove"),
            ("Ride Deep", "ride cymbal groove"),
            ("Shuffle", "swung hat pattern"),
            ("Open Hat Groove", "open hat on offbeats"),
            ("Standard", "solid four-on-floor base"),
            ("Open Close", "alternating hats with clap"),
            ("Syncopated", "pushed kick variation"),
            ("Ride Alt", "ride cymbal variation"),
            ("Open Hat Wide", "open hats for stereo width"),
            ("Full Standard", "complete standard pattern"),
            ("Minimal Clap", "just kick and clap"),
            ("Snare Groove", "snare instead of clap"),
            ("Double Open", "two open hat placements"),
            ("Full Drive", "driving complete pattern"),
            ("Ride Smooth", "smooth ride groove"),
            ("Kick Variation", "kick with extra hit"),
            ("Standard Clean", "clean four-on-floor"),
            ("Wide Open", "spacious open hat pattern"),
            ("Rolling", "rolling hat pattern"),
        ],
        "bass": [
            ("Smooth Root", "simple deep root pulse"),
            ("Melodic Line", "flowing bass melody"),
            ("Offbeat Pulse", "offbeat eighth notes"),
            ("Chord Tones", "root-3rd-5th movement"),
            ("Walking Groove", "stepwise walking bass"),
            ("Deep Root", "sustained deep root"),
            ("Rhythmic", "syncopated bass rhythm"),
            ("Minor Walk", "minor scale walking bass"),
            ("Quarter Pulse", "quarter note root pulse"),
            ("Offbeat Stab", "syncopated placement"),
            ("Scale Walk", "scale-based walking line"),
            ("Deep Hold", "single sustained note"),
            ("Velocity Pulse", "dynamic variation"),
            ("Simple Move", "basic chord movement"),
            ("Sparse Root", "minimal root placement"),
            ("Melodic Return", "out and back pattern"),
            ("Whisper Bass", "very quiet sustained"),
            ("Steady Climb", "ascending bass line"),
            ("Call and Return", "out and back to root"),
            ("Dotted Rhythm", "dotted note groove"),
        ],
    },
    "psytrance": {
        "synth": [
            ("Acid Lead", "303-style acid arpeggio"),
            ("Atmospheric", "sparse pad atmosphere"),
            ("Trance Gate", "rhythmic gated pad"),
            ("Alien FX", "weird chromatic intervals"),
            ("Rising Tension", "chromatic scale build"),
            ("Arp Cycle", "up-down arpeggio cycle"),
            ("Psy Melody", "minor scale psy melody"),
            ("Staccato", "rapid stab pattern"),
            ("Hypnotic", "one note velocity variation"),
            ("Wide Intervals", "octave jump pattern"),
            ("Triad Arp", "arpeggiated triad"),
            ("Deep Pad", "sustained atmosphere"),
            ("Fifth Bounce", "root-fifth alternation"),
            ("Double Pulse", "doubled note rhythm"),
            ("Micro Tonal", "semitone movement"),
            ("Full Scale", "complete scale run"),
            ("Sparse Hits", "widely spaced notes"),
            ("Velocity Pulse", "dynamic rhythmic pattern"),
            ("Minor Arp", "minor arpeggio cycle"),
            ("Driving Root", "rhythmic root pattern"),
        ],
        "drums": [
            ("Classic Psy", "kick every beat minimal hats"),
            ("Driving", "kick + offbeat open hats"),
            ("Snare on 3", "snare accent builds tension"),
            ("Sparse", "just driving kicks"),
            ("Clap Accent", "clap on 2+4 with kicks"),
            ("Open Accent", "open hat at bar end"),
            ("Full Hats", "constant 16th hats"),
            ("Heavy Kick", "emphasized kick hits"),
            ("Sparse Hats", "minimal hat placement"),
            ("Ride Drive", "ride cymbal momentum"),
            ("Open Close", "alternating hat types"),
            ("Standard", "solid psytrance base"),
            ("Snare Fill", "building snare tension"),
            ("Open End", "open hat at bar end"),
            ("Clap Alt", "clap variation pattern"),
            ("Snare Roll", "snare roll at end"),
            ("Driving Clean", "clean driving pattern"),
            ("Wide Open", "spacious open hat"),
            ("Full Standard", "complete psytrance kit"),
        ],
        "bass": [
            ("KBBB", "classic kick-bass-bass-bass per beat"),
            ("Rolling 16ths", "constant driving 16th notes"),
            ("Octave Bounce", "root and octave alternation"),
            ("Minor Scale Run", "scale-based rolling line"),
            ("Chromatic Slide", "semitone slide pattern"),
            ("Chord Tone Roll", "rolling with chord movement"),
            ("Gapped Roll", "rolling with occasional gaps"),
            ("Approach Notes", "chromatic approach pattern"),
            ("Split Roll", "two different note groups"),
            ("Walking Octave", "octave walk with passing"),
            ("Block Roll", "block note groups"),
            ("Melodic Roll", "melodic movement in rolls"),
            ("Micro Slide", "subtle semitone slides"),
            ("Triplet Feel", "three-note groups"),
            ("Scale Run", "full scale in 16ths"),
            ("Fifth Roll", "root and fifth alternation"),
            ("Split Groups", "different bass per beat"),
            ("Double Octave", "fast octave bounce"),
            ("Chromatic Walk", "chromatic walking bass"),
            ("Fading Roll", "roll with gaps at end"),
        ],
    },
}


# ═══════════════════════════════════════════════════════════════════════════
#  Output
# ═══════════════════════════════════════════════════════════════════════════

ALL_PATTERNS = {
    "dubstep": (DUBSTEP_SYNTH, DUBSTEP_DRUMS, DUBSTEP_BASS),
    "lo-fi": (LOFI_SYNTH, LOFI_DRUMS, LOFI_BASS),
    "synthwave": (SYNTHWAVE_SYNTH, SYNTHWAVE_DRUMS, SYNTHWAVE_BASS),
    "deep-house": (DEEPHOUSE_SYNTH, DEEPHOUSE_DRUMS, DEEPHOUSE_BASS),
    "psytrance": (PSYTRANCE_SYNTH, PSYTRANCE_DRUMS, PSYTRANCE_BASS),
}


def main():
    # Load existing data
    with open(os.path.join(DATA_DIR, "catalog.json")) as f:
        catalog = json.load(f)
    with open(os.path.join(DATA_DIR, "patterns-s1.json")) as f:
        s1 = json.load(f)
    with open(os.path.join(DATA_DIR, "patterns-t8-drums.json")) as f:
        t8d = json.load(f)
    with open(os.path.join(DATA_DIR, "patterns-t8-bass.json")) as f:
        t8b = json.load(f)

    for genre in NEW_GENRES:
        synth_pats, drum_pats, bass_pats = ALL_PATTERNS[genre]
        meta = PATTERN_META[genre]

        # Add to catalog
        synth_meta = [{"name": n, "desc": d} for n, d in meta["synth"]]
        drum_meta = [{"name": n, "desc": d} for n, d in meta["drums"]]
        bass_meta = [{"name": n, "desc": d} for n, d in meta["bass"]]

        catalog["s1"]["genres"].append({"name": genre, "patterns": synth_meta})
        catalog["t8"]["drum_genres"].append({"name": genre, "patterns": drum_meta})
        catalog["t8"]["bass_genres"].append({"name": genre, "patterns": bass_meta})

        # Add patterns (keyed by genre name)
        s1[genre] = synth_pats
        t8d[genre] = drum_pats
        t8b[genre] = bass_pats

    # Write updated files
    with open(os.path.join(DATA_DIR, "catalog.json"), "w") as f:
        json.dump(catalog, f, separators=(",", ":"))
    with open(os.path.join(DATA_DIR, "patterns-s1.json"), "w") as f:
        json.dump(s1, f, separators=(",", ":"))
    with open(os.path.join(DATA_DIR, "patterns-t8-drums.json"), "w") as f:
        json.dump(t8d, f, separators=(",", ":"))
    with open(os.path.join(DATA_DIR, "patterns-t8-bass.json"), "w") as f:
        json.dump(t8b, f, separators=(",", ":"))

    print(f"Added {len(NEW_GENRES)} new genres:")
    for g in NEW_GENRES:
        s, d, b = ALL_PATTERNS[g]
        print(f"  {g}: {len(s)} synth, {len(d)} drum, {len(b)} bass patterns")
    print(f"Total genres: {len(catalog['s1']['genres'])}")


if __name__ == "__main__":
    main()
