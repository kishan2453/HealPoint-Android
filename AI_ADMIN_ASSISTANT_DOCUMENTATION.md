# HealPoint – AI Administrative Operations Assistant Documentation (Part 19)

## 1. Overview
An intelligent administrative assistant that answers natural language operational inquiries using actual MongoDB data. It is non-clinical and strictly does not provide medical diagnoses or treatment recommendations.

## 2. Capabilities
- **Department Volume Analysis**: Identifies departments with highest appointment volume and utilization percentage.
- **Cancellation Pacing**: Analyzes cancellation rates, identifies peak cancellation dates, and suggests mitigation strategies.
- **Task & Schedule Overdue Tracking**: Flags overdue operational tasks and advises on backlog escalation.
- **Facility Resource Utilization**: Computes live occupancy percentages across beds, rooms, and diagnostic equipment.
- **Doctor Pacing**: Evaluates consultant consultation volume.

## 3. Strict Safety & Guardrail Design
- Operates strictly on authorized aggregate operational metrics.
- Enforces strict hospital tenant isolation.
- Disclaims clinical advice:
  > "HealPoint Operational AI provides administrative, non-clinical analytics only. It does not provide medical diagnoses or healthcare decisions."

## 4. API Endpoints
- `POST /api/v1/ai-assistant/query`: Analyzes natural language queries and returns structured answer, verified metrics, actionable suggestions, and non-clinical disclaimer.
