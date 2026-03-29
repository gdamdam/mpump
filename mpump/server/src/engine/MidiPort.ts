/** Wrapper around Web MIDI MIDIOutput for typed message sending. */
export class MidiPort {
  constructor(private output: MIDIOutput) {}

  get name(): string {
    return this.output.name ?? "";
  }

  get id(): string {
    return this.output.id;
  }

  noteOn(ch: number, note: number, vel: number, time?: number): void {
    this.output.send([0x90 | ch, note, vel], time);
  }

  noteOff(ch: number, note: number, time?: number): void {
    this.output.send([0x80 | ch, note, 0], time);
  }

  allNotesOff(ch: number, time?: number): void {
    this.output.send([0xb0 | ch, 123, 0], time);
  }

  programChange(ch: number, program: number, time?: number): void {
    this.output.send([0xc0 | ch, program], time);
  }

  clock(time?: number): void {
    this.output.send([0xf8], time);
  }
}
