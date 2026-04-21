// Checklist generator — turns form data into a tailored SOP.
// Every item has a stable id so preferences can be tracked across clients.

(function (global) {
  "use strict";

  const has = (v) => v !== undefined && v !== null && v !== "" && v !== "None" && v !== "No";
  const yes = (v) => v === "Yes";
  const n = (v) => Number(v || 0);

  function mk(id, text) { return { id, text }; }

  // -------------------- PRE-ONBOARDING --------------------
  function preOnboarding(d) {
    const items = [
      mk("pre.msa", "Countersigned MSA and service agreement on file"),
      mk("pre.scope", `Statement of work reflects: ${d.agreement || "agreement type TBD"} — ${d.mrr ? "$" + d.mrr + "/mo" : "pricing TBD"}`),
      mk("pre.sla", `SLA communicated: ${d.sla || "response targets TBD"}`),
      mk("pre.hours", `Business hours documented: ${d.hours || "TBD"}; after-hours: ${d.afterHours || "No"}`),
      mk("pre.contacts", "Primary, billing, and after-hours contacts recorded in PSA"),
      mk("pre.psa", "Client tenant / company created in PSA and documentation platform"),
      mk("pre.kickoff", "Kickoff meeting scheduled with stakeholders (30–60 min)"),
      mk("pre.comm", "Agreed support channels shared (phone, email-to-ticket, portal)"),
      mk("pre.welcome", "Welcome packet sent: how to open a ticket, escalation path, portal URL"),
      mk("pre.access", "Access request list drafted: admin creds, firewall, tenants, vendor portals"),
      mk("pre.assets", "Asset inventory spreadsheet template prepared"),
      mk("pre.billing", "Billing setup validated (PO, ACH, invoicing cadence)"),
    ];
    if (has(d.compliance)) {
      items.push(mk("pre.compliance", `Confirm compliance obligations in scope: ${d.compliance}`));
      items.push(mk("pre.baa", "Execute BAA / DPA where required before touching PHI / PII"));
    }
    if (yes(d.cyberIns)) {
      items.push(mk("pre.ins", "Review current cyber insurance questionnaire and note required controls"));
    }
    return items;
  }

  // -------------------- DISCOVERY --------------------
  function discovery(d) {
    const items = [
      mk("disc.walk", `Site walkthrough of ${d.locations || 1} location(s); photograph rack, IDFs, demarc`),
      mk("disc.inv.endpoints", `Inventory endpoints: ${n(d.winCount)} Windows, ${n(d.macCount)} macOS, ${n(d.linuxCount)} Linux, ${n(d.mobileCount)} mobile`),
      mk("disc.inv.servers", `Inventory servers: ${n(d.serverCount)} on-prem server(s); record roles, OS, warranty`),
      mk("disc.net.topology", "Document network topology (WAN, LAN, VLANs, wireless SSIDs)"),
      mk("disc.net.isp", `Collect ISP account numbers, speeds, static IPs: ${d.isp || "ISP TBD"}`),
      mk("disc.identity", `Export directory users / groups from ${d.directory || "directory TBD"}`),
      mk("disc.saas", "List all SaaS apps with admin contact, licensing, and SSO status"),
      mk("disc.lob", "Document line-of-business apps: vendor, support contract, install media, license keys"),
      mk("disc.licensing", "Collect license keys / subscriptions for OS, M365, AV, backup, LOB apps"),
      mk("disc.vendors", "Build vendor contact list (ISP, phones, copiers, LOB, facilities)"),
      mk("disc.dns", "Obtain registrar access for all domains; confirm DNS provider"),
      mk("disc.secrets", "Rotate shared admin passwords and store in password manager"),
      mk("disc.docs", "Run documentation audit against existing IT Glue / Hudu / SharePoint"),
    ];
    if (has(d.firewall)) items.push(mk("disc.fw", `Collect ${d.firewall} firewall admin creds, backup config, and licensing status`));
    if (has(d.switch)) items.push(mk("disc.sw", `Collect ${d.switch} switch creds, VLAN map, port map`));
    if (has(d.wifi)) items.push(mk("disc.wifi", `Document ${d.wifi} WiFi controller, SSIDs, PSKs / RADIUS`));
    if (has(d.vpn)) items.push(mk("disc.vpn", `Document ${d.vpn} configuration, user list, split-tunnel posture`));
    if (d.productivity === "Microsoft 365" || d.productivity === "Both") {
      items.push(mk("disc.m365", `Run M365 tenant audit: ${d.m365Plan || "plan"} — licensing, admin roles, secure score`));
      items.push(mk("disc.m365.dns", "Export MX, SPF, DKIM, DMARC records for every accepted domain"));
    }
    if (d.productivity === "Google Workspace" || d.productivity === "Both") {
      items.push(mk("disc.gws", "Run Google Workspace audit: licensing, super admins, OU structure"));
    }
    (d.iaas || []).forEach((p) => items.push(mk("disc.iaas." + p.toLowerCase(), `${p}: enumerate accounts/subscriptions, IAM, billing, tagging`)));
    if (has(d.pam)) items.push(mk("disc.pam", `Review ${d.pam} vault contents and ownership`));
    return items;
  }

  // -------------------- HARDENING & STANDARDIZATION --------------------
  function hardening(d) {
    const items = [
      mk("hard.naming", "Apply standard hostname and asset-tag convention"),
      mk("hard.local.admin", "Remove end-users from local admin; create break-glass local admin rotated via LAPS / equivalent"),
      mk("hard.disk", "Enable full-disk encryption on every workstation (BitLocker / FileVault) and escrow keys"),
      mk("hard.screenlock", "Enforce 10-minute inactivity lock and screen-lock policy"),
      mk("hard.usb", "Review removable-media policy; block where required by compliance"),
      mk("hard.baseline", "Apply standard security baseline (CIS L1 or vendor equivalent)"),
      mk("hard.updates", `Enforce ${d.patchCadence || "monthly"} OS and 3rd-party patching via RMM`),
      mk("hard.browser", "Deploy browser management (managed Chrome / Edge) and extension allowlist"),
    ];
    if (has(d.rmm)) items.push(mk("hard.rmm.deploy", `Deploy ${d.rmm} agent to 100% of endpoints and servers, verify check-in`));
    if (has(d.mdm)) items.push(mk("hard.mdm.enroll", `Enroll all devices into ${d.mdm} with baseline configuration profile`));
    if (has(d.edr)) items.push(mk("hard.edr", `Deploy ${d.edr} to 100% of endpoints; enable tamper protection and auto-isolation`));
    if (has(d.mdr)) items.push(mk("hard.mdr", `Onboard to ${d.mdr} MDR; verify 24/7 alerting reaches on-call`));
    if (has(d.dnsFilter)) items.push(mk("hard.dns", `Deploy ${d.dnsFilter} DNS filtering to all endpoints and networks`));

    // Identity
    if (d.mfa !== "Enforced all users") items.push(mk("hard.mfa", "Enforce MFA for 100% of users, with number-matching or phishing-resistant factors"));
    items.push(mk("hard.admin.sep", "Separate admin accounts from daily-driver accounts; no admin mailboxes"));
    if (d.conditionalAccess !== "Yes") items.push(mk("hard.ca", "Implement conditional access: block legacy auth, require compliant device, geo-restrict"));
    if (has(d.passwordMgr)) items.push(mk("hard.pwmgr", `Roll out ${d.passwordMgr} to all users; migrate shared secrets`));
    else items.push(mk("hard.pwmgr.new", "Roll out a password manager to all users"));

    // Networking
    if (has(d.firewall)) {
      items.push(mk("hard.fw.baseline", `Apply ${d.firewall} baseline: deny-any outbound logging, geo-IP, IPS, SSL inspection where feasible`));
      items.push(mk("hard.fw.admin", `Restrict ${d.firewall} admin access to mgmt VLAN / named IPs with MFA`));
      items.push(mk("hard.fw.fw.updates", `Enable scheduled firmware updates for ${d.firewall}`));
    }
    if (d.vlans !== "Yes") items.push(mk("hard.vlan", "Design and implement VLAN segmentation (users / servers / guest / IoT / mgmt)"));
    items.push(mk("hard.wifi.guest", "Isolate guest WiFi from internal VLANs; rotate PSK or use captive portal"));

    // Email
    if (d.productivity === "Microsoft 365" || d.productivity === "Both") {
      items.push(mk("hard.m365.sd", "Harden M365: disable legacy auth, enable Security Defaults or CA, enforce MFA on admins"));
      items.push(mk("hard.m365.dmarc", "Publish SPF, DKIM, DMARC (p=quarantine → reject) for all sending domains"));
      items.push(mk("hard.m365.share", "Review external sharing defaults in SharePoint / OneDrive / Teams"));
      items.push(mk("hard.m365.audit", "Enable unified audit log and mailbox auditing on all mailboxes"));
    }
    if (d.productivity === "Google Workspace" || d.productivity === "Both") {
      items.push(mk("hard.gws", "Harden Google Workspace: 2SV enforcement, context-aware access, advanced protection for admins"));
    }
    if (has(d.emailSec)) items.push(mk("hard.emailsec", `Deploy ${d.emailSec}: anti-phish, impersonation, attachment sandbox, banners for external mail`));

    items.push(mk("hard.awareness", has(d.sat)
      ? `Enroll all users into ${d.sat} with monthly phish + quarterly training`
      : "Stand up security awareness training with monthly phish simulation and quarterly training"));

    if (has(d.compliance)) {
      items.push(mk("hard.compliance", `Map controls to ${d.compliance} and document exceptions`));
    }
    return items;
  }

  // -------------------- MONITORING --------------------
  function monitoring(d) {
    const items = [
      mk("mon.rmm.alerts", "Apply standard RMM alert policy (disk, CPU, service, reboot, agent offline)"),
      mk("mon.uptime", "Configure external uptime monitoring for public-facing services and VPN"),
      mk("mon.cert", "Add SSL / domain expiry monitoring for all owned domains"),
      mk("mon.integration", "Integrate alerts into PSA for ticketing and SLA tracking; suppress noise"),
      mk("mon.runbook", "Document response runbook per alert type"),
    ];
    if (n(d.serverCount) > 0) {
      items.push(mk("mon.server.hw", "Enable hardware health (iDRAC / iLO / IPMI) monitoring and alerting"));
      items.push(mk("mon.server.services", "Monitor critical services: AD, DNS, DHCP, file shares, LOB databases"));
      items.push(mk("mon.server.events", "Forward Windows event logs for auth failures, account lockouts, privilege use"));
    }
    if (has(d.firewall)) items.push(mk("mon.fw.syslog", `Forward ${d.firewall} syslog to log store; alert on IPS blocks and VPN auth anomalies`));
    if (has(d.edr)) items.push(mk("mon.edr", `Validate ${d.edr} alerts route to on-call; test a benign detection end to end`));
    if (has(d.mdr)) items.push(mk("mon.mdr", `Validate ${d.mdr} MDR escalation path; confirm 24/7 phone tree`));
    if (d.productivity === "Microsoft 365" || d.productivity === "Both") {
      items.push(mk("mon.m365.alerts", "Enable M365 alert policies: impossible travel, forwarding rules, admin changes, risky sign-ins"));
    }
    if (yes(d.darkWeb)) items.push(mk("mon.darkweb", "Enroll client domains in breach / dark web monitoring"));
    if (yes(d.vulnScan)) items.push(mk("mon.vuln", "Schedule monthly external and quarterly internal vulnerability scans"));
    return items;
  }

  // -------------------- BACKUP VERIFICATION --------------------
  function backupVerify(d) {
    const items = [
      mk("bk.inventory", "List every system and dataset requiring protection; map to a backup job"),
      mk("bk.rpo", `Document RPO/RTO per workload; confirm ${d.retention || 90} day retention matches policy`),
    ];
    if (has(d.endpointBackup)) {
      items.push(mk("bk.endpoint.deploy", `Deploy ${d.endpointBackup} to all in-scope workstations; verify first successful backup`));
      items.push(mk("bk.endpoint.restore", "Perform a file-level restore test from 1 endpoint; document result"));
    }
    if (has(d.serverBackup) && n(d.serverCount) > 0) {
      items.push(mk("bk.server.deploy", `Verify ${d.serverBackup} jobs for all servers succeed for 7 consecutive days`));
      items.push(mk("bk.server.image", "Perform a full image restore test to isolated network; document RTO"));
      items.push(mk("bk.server.app", "Perform application-consistent restore test (AD, SQL, Exchange, LOB DB)"));
    }
    if (has(d.saasBackup)) {
      items.push(mk("bk.saas.deploy", `Confirm ${d.saasBackup} protects mailboxes, OneDrive, SharePoint, Teams / Drive`));
      items.push(mk("bk.saas.restore", "Perform a granular restore (1 mailbox item + 1 SharePoint / Drive file)"));
    }
    if (d.offsite !== "Yes") items.push(mk("bk.offsite", "Configure immutable / air-gapped offsite copy; verify initial seed"));
    items.push(mk("bk.alerts", "Route backup failure alerts to PSA; confirm SLA for a failed job"));
    items.push(mk("bk.schedule", "Schedule recurring restore tests: quarterly file, semi-annual full image"));
    items.push(mk("bk.doc", "Document restore runbook and store outside the client environment"));
    if (d.lastRestore) items.push(mk("bk.lastRestore", `Note prior restore test date on record: ${d.lastRestore}`));
    return items;
  }

  // -------------------- CLIENT HANDOFF --------------------
  function handoff(d) {
    const items = [
      mk("ho.doc.pack", "Deliver documentation pack: network diagram, asset list, credential inventory status"),
      mk("ho.portal", "Train primary contact on the support portal and ticket lifecycle"),
      mk("ho.escalate", "Review escalation matrix (P1/P2/P3) and after-hours expectations"),
      mk("ho.points", "Confirm authorized approvers for purchases, user changes, and after-hours work"),
      mk("ho.roster", "Deliver signed-off user roster and role mapping"),
      mk("ho.vciokick", "Schedule first business review / vCIO session (30–60 days out)"),
      mk("ho.feedback", "Send 30-day onboarding satisfaction survey"),
      mk("ho.closeout", "Close onboarding project and transition client to standard support queue"),
    ];
    if (has(d.included)) items.push(mk("ho.included", `Reconfirm included services with client: ${d.included.substring(0, 120)}${d.included.length > 120 ? "…" : ""}`));
    if (has(d.excluded)) items.push(mk("ho.excluded", `Reconfirm exclusions in writing: ${d.excluded.substring(0, 120)}${d.excluded.length > 120 ? "…" : ""}`));
    if (yes(d.cyberIns)) items.push(mk("ho.ins.attest", "Provide attestation letter matching insurance questionnaire controls"));
    return items;
  }

  // -------------------- ONGOING MAINTENANCE --------------------
  function maintenance(d) {
    const items = [
      { when: "Daily", items: [
        mk("ma.d.tickets", "Monitor ticket queue and SLA breaches"),
        mk("ma.d.alerts", "Triage overnight RMM / EDR / backup alerts"),
        mk("ma.d.backup", "Verify backup success dashboard; remediate failures same day"),
      ]},
      { when: "Weekly", items: [
        mk("ma.w.patch", `Review ${d.patchCadence || "monthly"} patch compliance report; remediate non-compliant devices`),
        mk("ma.w.admin", "Review privileged account activity and new admin role assignments"),
        mk("ma.w.phish", "Review phishing / reported messages queue"),
      ]},
      { when: "Monthly", items: [
        mk("ma.m.asset", "Reconcile asset inventory; retire or onboard devices"),
        mk("ma.m.users", "User lifecycle audit: disabled accounts, stale licenses, offboarding gaps"),
        mk("ma.m.restore", "Randomized file-level restore test"),
        mk("ma.m.firmware", "Firmware review for firewall, switches, APs, servers"),
        mk("ma.m.awareness", "Send monthly phishing simulation and review campaign results"),
      ]},
      { when: "Quarterly", items: [
        mk("ma.q.vciomtg", "Quarterly business review with client (roadmap, risks, spend)"),
        mk("ma.q.image", "Full image restore test of one critical server"),
        mk("ma.q.vuln", "Vulnerability scan review and remediation plan"),
        mk("ma.q.dr", "Tabletop: DR / ransomware scenario"),
        mk("ma.q.access", "Access review: who has admin, shared mailboxes, vendor access"),
      ]},
      { when: "Annually", items: [
        mk("ma.a.policy", "Review and re-sign MSA, SOW, BAA / DPA where applicable"),
        mk("ma.a.ins", "Refresh cyber insurance questionnaire and attestation"),
        mk("ma.a.pen", "External penetration test or posture assessment (as scoped)"),
        mk("ma.a.roadmap", "Technology roadmap and budget for next fiscal year"),
        mk("ma.a.licensing", "True-up all licensing (M365, AV, backup, LOB)"),
      ]},
    ];
    return items;
  }

  // -------------------- BUILD SOP --------------------
  function build(d) {
    return {
      client: d.company || "Client",
      generated: new Date().toISOString(),
      stack: stackChips(d),
      sections: [
        { key: "pre", title: "1. Pre-Onboarding Checklist", items: preOnboarding(d) },
        { key: "disc", title: "2. Discovery Tasks", items: discovery(d) },
        { key: "hard", title: "3. Hardening & Standardization", items: hardening(d) },
        { key: "mon", title: "4. Monitoring Setup", items: monitoring(d) },
        { key: "bk", title: "5. Backup Verification", items: backupVerify(d) },
        { key: "ho", title: "6. Client Handoff", items: handoff(d) },
      ],
      schedule: { key: "ma", title: "7. Ongoing Maintenance Schedule", groups: maintenance(d) },
      meta: metaPairs(d),
    };
  }

  function stackChips(d) {
    const chips = [];
    if (has(d.rmm)) chips.push(d.rmm);
    if (has(d.mdm)) chips.push(d.mdm);
    if (has(d.edr)) chips.push(d.edr);
    if (has(d.firewall)) chips.push(d.firewall);
    if (has(d.directory)) chips.push(d.directory);
    if (has(d.productivity)) chips.push(d.productivity);
    if (has(d.serverBackup)) chips.push(d.serverBackup);
    if (has(d.saasBackup)) chips.push(d.saasBackup);
    if (has(d.emailSec)) chips.push(d.emailSec);
    (d.iaas || []).forEach((x) => chips.push(x));
    return chips;
  }

  function metaPairs(d) {
    const pairs = [];
    if (d.industry) pairs.push(["Industry", d.industry]);
    if (d.headcount) pairs.push(["Headcount", d.headcount]);
    if (d.locations) pairs.push(["Locations", d.locations]);
    if (d.primaryContact) pairs.push(["Primary contact", d.primaryContact + (d.primaryContactEmail ? " <" + d.primaryContactEmail + ">" : "")]);
    if (d.agreement) pairs.push(["Agreement", d.agreement + (d.mrr ? " — $" + d.mrr + "/mo" : "")]);
    if (d.sla) pairs.push(["SLA", d.sla]);
    if (d.hours) pairs.push(["Hours", d.hours]);
    if (d.compliance) pairs.push(["Compliance", d.compliance]);
    return pairs;
  }

  global.Generator = { build };
})(window);
