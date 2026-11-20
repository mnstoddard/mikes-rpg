// Colours a character can be. New characters get one of these; pick another in ⚙️ Settings.
// Shared so the server only accepts these and the client can show them.
export const PLAYER_COLORS: { color: number; name: string }[] = [
  { color: 0xe74c3c, name: "Red" },
  { color: 0xe67e22, name: "Orange" },
  { color: 0xf1c40f, name: "Yellow" },
  { color: 0x2ecc71, name: "Green" },
  { color: 0x1abc9c, name: "Teal" },
  { color: 0x3498db, name: "Blue" },
  { color: 0x34495e, name: "Navy" },
  { color: 0x9b59b6, name: "Purple" },
  { color: 0xff6ec7, name: "Pink" },
  { color: 0x8e5a2b, name: "Brown" },
  { color: 0xecf0f1, name: "White" },
  { color: 0x2b2b2b, name: "Black" },
];
export const isPlayerColor = (c: unknown): c is number => PLAYER_COLORS.some((p) => p.color === c);
