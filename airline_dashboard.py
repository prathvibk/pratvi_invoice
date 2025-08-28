from flask import Flask, render_template, jsonify, request, send_from_directory
import pandas as pd
import random
from datetime import datetime
import os

app = Flask(__name__)

INVOICE_DIR = os.path.join(os.getcwd(), "invoices")


def load_passengers():
    df = pd.read_csv("data.csv")
    passengers = []
    for idx, row in df.iterrows():
        ticket_no = str(row["Ticket Number"]).strip()

        
        if ticket_no.endswith(".0"):
            ticket_no = ticket_no[:-2]

        passengers.append({
            "id": int(idx) + 1,  
            "ticket_number": ticket_no,
            "first_name": str(row["First Name"]),
            "last_name": str(row["Last Name"]),
            "download_status": "Pending",
            "parse_status": "Pending",
            "pdf_filename": None
        })
    return passengers

PASSENGERS = load_passengers()
INVOICES = []

@app.route("/")
def index():
    return render_template("dashboard.html")

# Passengers API
@app.route("/api/passengers")
def get_passengers():
    q = request.args.get("q", "").lower()
    results = PASSENGERS
    if q:
        results = [
            p for p in PASSENGERS
            if q in p["ticket_number"].lower() or
               q in (p["first_name"] + " " + p["last_name"]).lower()
        ]
    return jsonify(results)





# Invoices API
@app.route("/api/invoices")
def get_invoices():
    return jsonify(INVOICES)

# Summary API
@app.route("/api/summary")
def get_summary():
    summary = {}
    high_value_count = 0
    for inv in INVOICES:
        airline = inv["airline"]
        summary[airline] = summary.get(airline, 0) + inv["amount"]
        if inv["amount"] > 10000:
            high_value_count += 1

    result = {
        "airline_totals": [
            {"airline": k, "total": v, "count": sum(1 for i in INVOICES if i["airline"] == k)}
            for k, v in summary.items()
        ],
        "high_value_count": high_value_count
    }
    return jsonify(result)

# Real invoice download (based on ticket number)
@app.route("/api/download/<pid>", methods=["POST"])
def download_invoice(pid):
    for p in PASSENGERS:
        if str(p["ticket_number"]) == pid:   
            pdf_file = f"{pid}.pdf"
            pdf_path = os.path.join(INVOICE_DIR, pdf_file)

            if os.path.exists(pdf_path):
                p["download_status"] = "Success"
                p["pdf_filename"] = pdf_file
                return send_from_directory(INVOICE_DIR, pdf_file, as_attachment=True)
            else:
                p["download_status"] = "Not Found"
                return jsonify({"error": "Invoice PDF not found"}), 404

    return jsonify({"error": "Passenger not found"}), 404


# Simulated invoice parsing
@app.route("/api/parse/<pid>", methods=["POST"])
def parse_invoice(pid):
    for p in PASSENGERS:
        if str(p["ticket_number"]) == pid:   
            if p["download_status"] != "Success":
                return jsonify({"error": "Invoice not downloaded"}), 400

            invoice = {
                "invoice_number": f"INV-{random.randint(1000,9999)}",
                "date": datetime.now().strftime("%Y-%m-%d"),
                "airline": "Thai Airways",
                "amount": round(random.uniform(100, 20000), 2),
                "gstin": random.choice([None, "29ABCDE1234F2Z5"]),
                "confidence": random.randint(80, 100),
                "ticket_number": p["ticket_number"],
                "first_name": p["first_name"],
                "last_name": p["last_name"],
                "passenger_id": p["id"]
            }
            INVOICES.append(invoice)
            p["parse_status"] = "Success"
            return jsonify(invoice)
    return jsonify({"error": "Passenger not found"}), 404



@app.route("/invoices/<filename>")
def serve_invoice(filename):
    return send_from_directory(INVOICE_DIR, filename)

if __name__ == "__main__":
    app.run(debug=True)
