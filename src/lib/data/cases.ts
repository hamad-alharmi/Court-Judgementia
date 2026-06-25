// ===== Judgementia — Case File Dataset (plain, readable English) =====
import type { CaseScenario } from "@/lib/types";

export const CASE_SCENARIOS: CaseScenario[] = [
  {
    id: "rogue-auditor",
    title: "The Rogue Auditor",
    theme: "corporate",
    facts:
      "A company auditor is accused of breaking past internal security and leaking confidential financial records to the public.",
    evidence: [
      {
        id: "ra-ev1",
        title: "Root SSH Log at 03:44 AM",
        description:
          "Server logs show the defendant's private key logging into the main production server at 03:44 AM, just six minutes before the leak went public. The key matches the one issued to the auditor.",
        assetType: "Mainframe root logs",
        side: "prosecution",
      },
      {
        id: "ra-ev2",
        title: "Warning Email to Execs",
        description:
          "An email from the defendant, sent 24 hours before the leak, warns leadership about weak security and asks for a code freeze. Leadership denied the freeze but never told the security team.",
        assetType: "Email archive",
        side: "defense",
      },
      {
        id: "ra-ev3",
        title: "Anonymous Crypto Transfer",
        description:
          "A transfer of 50 ETH to an unknown wallet happened right after the leak. The wallet has no owner on file, and the money passed through three mixing services before landing in cold storage.",
        assetType: "On-chain ledger",
        side: "ambiguous",
      },
    ],
  },
  {
    id: "industrial-espionage",
    title: "Industrial Espionage",
    theme: "corporate fraud",
    facts:
      "A developer is accused of copying code from an unverified third-party AI model and pasting it into a secure banking system.",
    evidence: [
      {
        id: "ie-ev1",
        title: "Code Match Report",
        description:
          "A side-by-side check shows the banking system's new AI module is 98% identical to a stolen model. Same layout, same random seed, and the same leftover license headers are still in the files.",
        assetType: "Binary comparison",
        side: "prosecution",
      },
      {
        id: "ie-ev2",
        title: "Approved Test Access",
        description:
          "A timestamped approval shows the head of security gave the developer permission to test that exact repo on the morning of the merge. The note says 'evaluate for adoption'.",
        assetType: "Access log",
        side: "defense",
      },
      {
        id: "ie-ev3",
        title: "Wiped Git History",
        description:
          "The developer's local git log shows twelve commits were force-deleted just before the audit. Recovered messages include 'cleanup', 'remove vendor stubs', and 'purge attribution'.",
        assetType: "Recovered git log",
        side: "prosecution",
      },
    ],
  },
  {
    id: "supply-chain-collision",
    title: "Supply Chain Collision",
    theme: "supply chain",
    facts:
      "A network tech is accused of pushing an unverified system patch that crashed an automated warehouse, causing a multi-million dollar pile-up.",
    evidence: [
      {
        id: "sc-ev1",
        title: "Broken Patch Signature",
        description:
          "A security report shows the patch skipped the central signature check. The expected hash is empty, and the patch's security certificate chain is expired and forged.",
        assetType: "Network report",
        side: "prosecution",
      },
      {
        id: "sc-ev2",
        title: "Emergency Stop Ignored",
        description:
          "Warehouse logs show the machines ignored the emergency stop command for 11 seconds BEFORE the patch was applied. The override was set by an upstream controller, not the tech's terminal.",
        assetType: "Machine telemetry",
        side: "defense",
      },
      {
        id: "sc-ev3",
        title: "Faked IP Address",
        description:
          "Forensic capture shows the patch request came from an outside machine pretending to be the tech's terminal. The MAC address was cloned and the network hop count doesn't match the internal network.",
        assetType: "Routing capture",
        side: "ambiguous",
      },
    ],
  },
];

export function getScenarioById(id: string): CaseScenario | undefined {
  return CASE_SCENARIOS.find((c) => c.id === id);
}

export function randomScenarioId(): string {
  return CASE_SCENARIOS[Math.floor(Math.random() * CASE_SCENARIOS.length)].id;
}
