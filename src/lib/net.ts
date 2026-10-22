// Node 22 gives each address only 250 ms when it races IPv4/IPv6 ("happy eyeballs"). From far-away
// networks (e.g. Lagos → Oregon is ~260 ms) every attempt times out, so allow more time per attempt.
import net from "node:net";

net.setDefaultAutoSelectFamilyAttemptTimeout(2_000);
