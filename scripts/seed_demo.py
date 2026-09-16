#!/usr/bin/env python3
"""Populate the VRA Performance Tracker dev DB with a realistic demo set:
3 supervisors, 15 staff (2 DTI + 2 Finance + 1 MIS per supervisor), and
3 monthly reports each (Jul approved, Aug fully declined, Sep part-approved / part-declined).
Runs against the local API using dev-cookie auth."""
import json, sys, urllib.request, urllib.error, urllib.parse, http.cookiejar
from collections import Counter

BASE = "http://localhost:5202"
cj = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
_cur = None


def call(method, path, body=None, ok=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method)
    if data is not None:
        req.add_header("Content-Type", "application/json")
    try:
        with opener.open(req) as r:
            txt, st = r.read().decode(), r.status
    except urllib.error.HTTPError as e:
        txt, st = e.read().decode(), e.code
    parsed = json.loads(txt) if txt.strip() else None
    if ok and st not in ok:
        print(f"!! {method} {path} -> {st}\n   {parsed}", file=sys.stderr)
        raise SystemExit(1)
    return st, parsed


def login(email):
    global _cur
    if _cur != email:
        call("POST", "/auth/dev-login", {"email": email}, ok=(200,))
        _cur = email


ADMIN = "dti.apps@vra.com"
login(ADMIN)


def ensure_user(payload):
    st, u = call("POST", "/users/", payload)
    if st in (200, 201):
        return u
    if st == 409:
        _, lst = call("GET", "/users/?q=" + urllib.parse.quote(payload["email"]), ok=(200,))
        for x in lst:
            if x["email"] == payload["email"].lower():
                return x
    print(f"!! create {payload['email']} -> {st} {u}", file=sys.stderr)
    raise SystemExit(1)


# ---------- supervisors ----------
_, sup_list = call("GET", "/users/?role=Supervisor", ok=(200,))
yaw = next(u for u in sup_list if u["email"] == "dennis.asiedu@vra.com")
supB = ensure_user({"email": "abena.owusuansah@vra.com", "fullName": "Abena Owusu-Ansah",
                    "role": "Supervisor", "staffId": "VRA-0011", "department": "VRA Academy",
                    "jobTitle": "Senior Manager, Digital"})
supC = ensure_user({"email": "kwesi.appiah@vra.com", "fullName": "Kwesi Appiah",
                    "role": "Supervisor", "staffId": "VRA-0012", "department": "VRA Academy",
                    "jobTitle": "Manager, Finance Systems"})
supervisors = [yaw, supB, supC]

# ---------- staff roster: 6 DTI, 6 Finance, 3 MIS; 5 per supervisor ----------
JOB = {"DTI": "IT Officer (National Service)",
       "Finance": "Accounts Officer (National Service)",
       "MIS": "MIS Analyst (National Service)"}
roster = [
    ("Kojo Mensah",      "kojo.mensah@vra.com",      "DTI",     "VRA-5001", 0),
    ("Adwoa Boateng",    "adwoa.boateng@vra.com",    "DTI",     "VRA-5002", 0),
    ("Akua Agyeman",     "akua.agyeman@vra.com",     "Finance", "VRA-5003", 0),
    ("Kwabena Ofori",    "kwabena.ofori@vra.com",    "Finance", "VRA-5004", 0),
    ("Nana Acheampong",  "nana.acheampong@vra.com",  "MIS",     "VRA-5005", 0),

    ("Yaw Darko",        "yaw.darko@vra.com",        "DTI",     "VRA-5006", 1),
    ("Esi Owusu",        "esi.owusu@vra.com",        "DTI",     "VRA-5007", 1),
    ("Abena Nyarko",     "abena.nyarko@vra.com",     "Finance", "VRA-5008", 1),
    ("Yaa Amoah",        "yaa.amoah@vra.com",        "Finance", "VRA-5009", 1),
    ("Abena Frimpong",   "abena.frimpong@vra.com",   "MIS",     "VRA-5010", 1),

    ("Kofi Asante",      "kofi.asante@vra.com",      "DTI",     "VRA-5011", 2),
    ("Ama Sarpong",      "ama.sarpong@vra.com",      "DTI",     "VRA-5012", 2),
    ("Kwaku Antwi",      "kwaku.antwi@vra.com",      "Finance", "VRA-5013", 2),
    ("Efua Addo",        "efua.addo@vra.com",        "Finance", "VRA-5014", 2),
    ("Kojo Bediako",     "kojo.bediako@vra.com",     "MIS",     "VRA-5015", 2),
]
staff_recs = []
for (name, email, dept, sid, si) in roster:
    sup = supervisors[si]
    u = ensure_user({"email": email, "fullName": name, "role": "Staff", "staffId": sid,
                     "department": dept, "jobTitle": JOB[dept], "supervisorUserId": sup["id"]})
    staff_recs.append((u, dept, sup))

# ---------- report content, themed by department ----------
ACT = {
    "DTI": [
        ("Dashboard migration", "Rebuilt the monthly generation and revenue dashboards in Power BI", "3 of 4 dashboards published to the shared workspace"),
        ("Tier-2 support", "Resolved escalated tickets for the finance and HR modules", "SLA met on 92% of tickets this month"),
        ("Integration job", "Wrote the nightly sync between SAP and the asset register", "Job scheduled and running; one failure logged and fixed"),
        ("Runbook drafting", "Documented the backup and restore procedure for the reporting server", "Draft circulated for review"),
    ],
    "Finance": [
        ("Bank reconciliation", "Reconciled bank statements against the ledger for three operating accounts", "All three accounts tied out"),
        ("Payment vouchers", "Prepared and checked payment vouchers for the month", "120 vouchers processed within the 2-day target"),
        ("Variance analysis", "Compiled the Q3 budget-versus-actual report for six cost centres", "Report issued to unit heads"),
        ("Asset verification", "Joined the physical asset count at the Akuse depot", "Verification 70% complete"),
    ],
    "MIS": [
        ("Data quality checks", "Ran monthly validation on the payroll and HR extracts", "Flagged 34 records for correction"),
        ("Report automation", "Automated the weekly headcount report", "Live; saves about three hours a week"),
        ("Access review", "Reviewed reporting-portal access for 45 users", "Eight access removals actioned"),
        ("Ad-hoc analysis", "Built the overtime trend analysis requested by the Director", "Delivered; follow-up questions received"),
    ],
}
FOC = {
    "DTI": [
        ("Finish the dashboard migration", "All eight dashboards on the new Power BI workspace", "Access to the production workspace"),
        ("Shadow a release", "Able to run a deployment unaided", "Time with the DevOps lead"),
    ],
    "Finance": [
        ("Support the Q3 close", "Trial balance ready by the 10th", "Sign-off from the senior accountant"),
        ("Learn the treasury module", "Process routine FX deals independently", "A booked training session"),
    ],
    "MIS": [
        ("Roll the headcount report out org-wide", "Every unit subscribed to the automated report", "Distribution list from HR"),
        ("Start the data dictionary", "First draft covering three source systems", "Read access to the source schemas"),
    ],
}
NARR = {
    "DTI": dict(newSkills="Power BI data modelling and DAX",
                knowledgeGained="How the DTI change-release process works end to end",
                toolsLearned="Power BI, Git, Azure DevOps"),
    "Finance": dict(newSkills="Bank reconciliation and voucher control in SAP FI",
                    knowledgeGained="The Authority's month-end close calendar",
                    toolsLearned="SAP FI, Excel Power Query"),
    "MIS": dict(newSkills="SQL window functions and data validation",
                knowledgeGained="Structure of the payroll and HR source systems",
                toolsLearned="SQL Server, Python pandas, Power BI"),
}


def save_body(kind, name, dept):
    acts, focs, nr = ACT[dept], FOC[dept], NARR[dept]
    if kind == "approve":
        st, fst, sign = ["Completed", "Completed", "Completed", "Ongoing"], ["Completed", "Pending"], "2026-07-31"
        challenges = "A short delay getting system access early in the month; resolved by mid-month."
    elif kind == "decline_all":
        st, fst, sign = ["Ongoing", "Completed", "Ongoing", "Ongoing"], ["Update", "Pending"], "2026-08-29"
        challenges = "Competing priorities meant two tasks slipped; the outputs are thinner than planned."
    else:  # mixed
        st, fst, sign = ["Completed", "Completed", "Ongoing", "Ongoing"], ["Pending", "Update"], "2026-09-05"
        challenges = "Waiting on input from another unit held up the reconciliation work."
    return {
        "keyAchievements": f"Completed {acts[0][0].lower()} and cleared the backlog carried over from the previous month.",
        "innovations": f"Set up a short checklist for {acts[1][0].lower()} that has cut rework.",
        "newSkills": nr["newSkills"], "knowledgeGained": nr["knowledgeGained"], "toolsLearned": nr["toolsLearned"],
        "keyChallenges": challenges,
        "supportRequired": "Earlier provisioning of system access and a second review pass on the more complex tasks.",
        "staffSignatureName": name, "staffSignOffDate": sign,
        "activities": [{"id": None, "lineNo": i + 1, "keyActivity": a[0], "descriptionOfWork": a[1],
                        "outputResult": a[2], "status": st[i]} for i, a in enumerate(acts)],
        "focusAreas": [{"id": None, "lineNo": i + 1, "plannedActivity": f[0], "expectedOutcome": f[1],
                        "supportRequired": f[2], "status": fst[i]} for i, f in enumerate(focs)],
    }


def appraise_body(kind, sup_name, acts=None, focs=None):
    if kind == "approve":
        return {
            "qualityOfWorkRating": 4, "qualityOfWorkComment": "Solid, accurate work.",
            "productivityRating": 4, "productivityComment": "Good throughput this month.",
            "initiativeRating": 5, "initiativeComment": "Took the checklist idea and ran with it.",
            "teamworkRating": 4, "teamworkComment": "Works well with the rest of the unit.",
            "complianceRating": 5, "complianceComment": "Followed process throughout.",
            "overallRating": None,
            "supervisorGeneralComments": "A strong month. Keep it up and push the last item to completion.",
            "supervisorSignatureName": sup_name, "supervisorSignOffDate": "2026-08-05",
            "decision": "Approved", "decisionComment": None,
        }
    if kind == "decline_all":
        acmt = ["Give the output in numbers - how many, what value, measured how.",
                "This reads as a plan, not what you actually did. Rewrite in the past tense with the result.",
                "No evidence attached. Add the log or a reference.",
                "Too vague. Say what was produced and where it is."]
        fcmt = ["Expected outcome isn't measurable. Make it something we can check.",
                "Support required is missing - who do you need, and by when?"]
        return {
            "qualityOfWorkRating": 2, "qualityOfWorkComment": "Outputs are not clearly evidenced.",
            "productivityRating": 3, "productivityComment": "Reasonable effort but two tasks slipped.",
            "initiativeRating": 2, "initiativeComment": "Waited to be told rather than raising blockers early.",
            "teamworkRating": 3, "teamworkComment": "Fine, no concerns.",
            "complianceRating": 3, "complianceComment": "Mostly followed process.",
            "overallRating": None,
            "supervisorGeneralComments": "The month's work is there but the write-up doesn't show it. Please revise every section and resubmit.",
            "supervisorSignatureName": sup_name, "supervisorSignOffDate": "2026-09-04",
            "decision": "Declined",
            "decisionComment": "Every row needs work - see the per-row notes. Rewrite in the past tense, quantify the outputs, and attach evidence.",
            "activityReviews": [{"id": a["id"], "status": "Declined", "comment": c} for a, c in zip(acts, acmt)],
            "focusReviews": [{"id": f["id"], "status": "Declined", "comment": c} for f, c in zip(focs, fcmt)],
        }
    # mixed: first two activities approved (locked), last two declined; focus 1 approved, focus 2 declined
    st = ["Approved", "Approved", "Declined", "Declined"]
    cm = [None, None,
          "Output is not quantified - add the numbers.",
          "Still described as ongoing with no interim result. Add what's done so far."]
    return {
        "qualityOfWorkRating": 3, "qualityOfWorkComment": "Mixed - some rows are fine, others thin.",
        "productivityRating": 4, "productivityComment": "Good output volume.",
        "initiativeRating": 3, "initiativeComment": "Reasonable.",
        "teamworkRating": 4, "teamworkComment": "Good.",
        "complianceRating": 4, "complianceComment": "Process followed.",
        "overallRating": None,
        "supervisorGeneralComments": "Two activities are approved and locked. Fix the two flagged rows and the flagged focus area, then resubmit.",
        "supervisorSignatureName": sup_name, "supervisorSignOffDate": "2026-09-07",
        "decision": "Declined",
        "decisionComment": "Approved rows are locked. Revise only the rows marked 'needs work'.",
        "activityReviews": [{"id": a["id"], "status": st[i], "comment": cm[i]} for i, a in enumerate(acts)],
        "focusReviews": [{"id": focs[0]["id"], "status": "Approved", "comment": None},
                         {"id": focs[1]["id"], "status": "Declined", "comment": "Make the expected outcome measurable."}],
    }


# ---------- run the lifecycle ----------
MONTHS = [(2026, 7, "approve"), (2026, 8, "decline_all"), (2026, 9, "mixed")]
summary = Counter()
for (u, dept, sup) in staff_recs:
    made = []
    login(u["email"])
    for (y, m, kind) in MONTHS:
        st, rep = call("POST", f"/reports/mine/{y}/{m}")
        if st == 409:
            st, rep = call("GET", f"/reports/mine/{y}/{m}", ok=(200,))
        elif st not in (200, 201):
            print("create fail", u["email"], y, m, st, rep, file=sys.stderr)
            raise SystemExit(1)
        rid = rep["id"]
        call("PUT", f"/reports/{rid}", save_body(kind, u["fullName"], dept), ok=(200,))
        _, rep = call("POST", f"/reports/{rid}/submit", ok=(200,))
        made.append((kind, rid, rep["activities"], rep["focusAreas"]))
    login(sup["email"])
    for (kind, rid, acts, focs) in made:
        _, rep = call("POST", f"/reports/{rid}/appraise", appraise_body(kind, sup["fullName"], acts, focs), ok=(200,))
        summary[rep["status"]] += 1
    print(f"  {u['fullName']:<17} {dept:<8} -> {sup['fullName']:<17} : 3 reports")

# ---------- recap ----------
login(ADMIN)
_, allu = call("GET", "/users/", ok=(200,))
by_sup = Counter(x["supervisorUserName"] for x in allu if x["role"] == "Staff" and x["supervisorUserName"])
print("\nDONE")
print(f"  supervisors: {len(supervisors)}   staff: {len(staff_recs)}   reports appraised: {sum(summary.values())}")
print(f"  report status: {dict(summary)}")
print(f"  staff per supervisor: {dict(by_sup)}")
