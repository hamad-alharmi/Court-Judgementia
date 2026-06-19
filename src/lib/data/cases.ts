// ===== Judgementia — High-Stakes Case File Dataset =====
import type { CaseScenario } from "@/lib/types";

export const CASE_SCENARIOS: CaseScenario[] = [
  {
    id: "rogue-auditor",
    title: "The Rogue Auditor",
    facts:
      "A cybersecurity auditor intentionally bypassed the company's internal mainframe security protocols, exposing sensitive development source code to the public web.",
    evidence: [
      {
        id: "ra-ev1",
        title: "Root SSH Log 03:44 AM",
        description:
          "Shows the defendant's unique cryptographic key logging into the core production mainframe at 03:44 AM, six minutes before the public exposure event. The key fingerprint matches the auditor's issued credential and the session originated from their assigned terminal subnet.",
        assetType: "Mainframe root logs",
        side: "prosecution",
      },
      {
        id: "ra-ev2",
        title: "Internal Memo Leak",
        description:
          "Encrypted chat logs showing the defendant warned executives about systemic vulnerabilities 24 hours prior to the incident, formally requesting a code-freeze that was denied. The denial was logged but never surfaced to the security committee.",
        assetType: "Decrypted chat streams",
        side: "defense",
      },
      {
        id: "ra-ev3",
        title: "Offshore Ledger Entry",
        description:
          "An anonymous transfer of 50 ETH to an unverified wallet node immediately following the data breach. The wallet has no KYC linkage, and the routing path transits three mixers before terminating at a cold-storage vault of unknown ownership.",
        assetType: "On-chain forensic ledger",
        side: "ambiguous",
      },
    ],
  },
  {
    id: "industrial-espionage",
    title: "Industrial Espionage",
    facts:
      "A developer is accused of secretly copy-pasting proprietary code from an unverified third-party machine-learning model into a secured banking framework.",
    evidence: [
      {
        id: "ie-ev1",
        title: "Decompiled Binary Delta",
        description:
          "A code comparison showing 98% structural similarity between the banking framework's new inference module and the stolen model. Identical tensor layout, identical dropout seeding, and matching license-header stubs survive the decompilation.",
        assetType: "Binary delta analysis",
        side: "prosecution",
      },
      {
        id: "ie-ev2",
        title: "Authorized Sandbox Log",
        description:
          "A compliance timestamp proving the developer was granted testing permission for that specific repository on the morning of integration, signed by the head of platform security. The sandbox record includes an explicit 'evaluate for adoption' annotation.",
        assetType: "Compliance access log",
        side: "defense",
      },
      {
        id: "ie-ev3",
        title: "Scrubbed Local Commit History",
        description:
          "A local git log showing forced history deletions right before the internal audit, with reflog residue pointing to twelve squashed commits. Recovered commit messages reference 'cleanup', 'remove vendor stubs', and 'purge attribution'.",
        assetType: "Recovered git reflog",
        side: "prosecution",
      },
    ],
  },
  {
    id: "supply-chain-collision",
    title: "Supply Chain Collision",
    facts:
      "A network technician authorized an unverified, forced system patch to an automated logistics facility network, inducing a multi-million dollar supply chain collision.",
    evidence: [
      {
        id: "sc-ev1",
        title: "Patch Signature Mismatch",
        description:
          "A network report proving the firmware patch bypassed the central cryptographic security handshake. The expected SHA-512 signature resolves to a null digest, and the patch header carries a forged CA chain with an expired root.",
        assetType: "Network security report",
        side: "prosecution",
      },
      {
        id: "sc-ev2",
        title: "Automated Overdrive Override",
        description:
          "Telemetry showing the logistics facility's autonomous machinery ignored automated emergency stop commands for 11 seconds prior to the patch deployment. The override flag was set by a upstream orchestrator, not by the technician's terminal.",
        assetType: "Facility telemetry stream",
        side: "defense",
      },
      {
        id: "sc-ev3",
        title: "Spoofed IP Routing Table",
        description:
          "Forensic evidence showing the patch request originated from an external node mimicking the technician's terminal ID. ARP cache entries reveal a cloned MAC address and a TTL anomaly inconsistent with the internal backbone.",
        assetType: "Forensic routing capture",
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
