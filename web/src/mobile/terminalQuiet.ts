/**
 * Do not answer Device Attributes on the phone.
 *
 * tmux 3.6 asks the terminal who it is (DA1 `CSI c`, DA2 `CSI > c`) when a
 * client attaches. On the phone the answer can arrive late — the app was
 * suspended in the background, or the round trip through the Cloudflare Tunnel
 * is slow — and tmux, no longer waiting for it, hands it to the pane as typed
 * keys: the shell prompt fills with `1;2c0;276;0c`. Unanswered, tmux falls back
 * to terminfo for the outer terminal, which is all a phone needs; programs
 * inside tmux are answered by tmux itself. The desk keeps xterm's replies.
 *
 * A handler that returns true replaces xterm's built-in one (as
 * lib/xtermDecrqm.ts does for DECRQM), so no reply is written.
 */
type WithParser = {
  parser: {
    registerCsiHandler: (
      id: { prefix?: string; intermediates?: string; final: string },
      cb: () => boolean,
    ) => { dispose(): void };
  };
};

export function quietDeviceAttributes(term: WithParser): void {
  term.parser.registerCsiHandler({ final: "c" }, () => true);
  term.parser.registerCsiHandler({ prefix: ">", final: "c" }, () => true);
}
