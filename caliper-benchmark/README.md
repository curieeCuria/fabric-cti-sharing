# Caliper Benchmark Setup

## Prerequisites

Install Node.js and npm:
```bash
sudo apt update
sudo apt install nodejs npm
```

## Install Dependencies

In the project directory, run:
```bash
npm install
```

## Accessing Prometheus Metrics

To enable Caliper to access Prometheus metrics, forward the Prometheus service port:
```bash
kubectl port-forward -n monitoring svc/prometheus-kube-prometheus-prometheus 9090:9090
```
Leave this command running in a separate terminal while benchmarking.

## Running the Benchmark

Start the Caliper benchmark:
```bash
npm start
```
---