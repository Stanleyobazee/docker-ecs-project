# Borderless Tech Academy — Docker & AWS ECS Deployment Project

A hands-on DevOps project that containerizes a Node.js REST API and deploys it to AWS ECS Fargate with an Application Load Balancer, demonstrating real-world container orchestration, zero-downtime deployments, and cloud-native observability.

---

## Table of Contents

- [Project Aims](#project-aims)
- [Objectives](#objectives)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [What We Built](#what-we-built)
- [Technology Stack](#technology-stack)
- [Setup & Deployment Guide](#setup--deployment-guide)
- [Update Workflow](#update-workflow)
- [API Endpoints](#api-endpoints)
- [Learning Curves & Challenges](#learning-curves--challenges)
- [What We Achieved](#what-we-achieved)

---

## Project Aims

The aim of this project is to provide a practical, end-to-end experience of containerizing an application and deploying it to a production-grade cloud environment using AWS managed services. It bridges the gap between local development and real-world cloud deployments by walking through every layer of the stack — from writing a Dockerfile to configuring an ALB with health checks on AWS ECS Fargate.

---

## Objectives

- Containerize a Node.js application using Docker with a multi-stage build
- Push the container image to Amazon Elastic Container Registry (ECR)
- Deploy the containerized application to Amazon ECS using the Fargate launch type
- Set up an Application Load Balancer (ALB) to distribute traffic across multiple containers
- Implement container-level health checks for reliability
- Enable container observability — identify each container uniquely via ECS task metadata
- Demonstrate zero-downtime rolling deployments when updating the application
- Apply security best practices — least privilege IAM roles, security groups restricting traffic flow

---

## Architecture

```
                        ┌─────────────────────────────────────────────────────┐
                        │                    AWS Cloud (eu-north-1)            │
                        │                                                      │
   Internet             │   ┌─────────────────────────────────────────────┐   │
      │                 │   │              VPC (vpc-0a38d449687a7d8f7)     │   │
      │                 │   │                                              │   │
      ▼                 │   │  ┌──────────────────────────────────────┐   │   │
┌──────────┐            │   │  │   ALB Security Group (academy-alb-sg)│   │   │
│  Client  │──HTTP:80──►│───┼─►│   Inbound: 0.0.0.0/0 port 80        │   │   │
└──────────┘            │   │  └──────────────┬───────────────────────┘   │   │
                        │   │                 │                            │   │
                        │   │                 ▼                            │   │
                        │   │  ┌──────────────────────────────────────┐   │   │
                        │   │  │  Application Load Balancer           │   │   │
                        │   │  │  (academy-alb)                       │   │   │
                        │   │  │  Listener: HTTP:80                   │   │   │
                        │   │  │  Target Group: academy-tg (port 3000)│   │   │
                        │   │  └──────┬──────────┬──────────┬─────────┘   │   │
                        │   │         │          │          │              │   │
                        │   │  ┌──────────────────────────────────────┐   │   │
                        │   │  │   ECS Security Group (academy-ecs-sg)│   │   │
                        │   │  │   Inbound: port 3000 from ALB SG only│   │   │
                        │   │  └──────┬──────────┬──────────┬─────────┘   │   │
                        │   │         │          │          │              │   │
                        │   │         ▼          ▼          ▼              │   │
                        │   │  ┌────────┐  ┌────────┐  ┌────────┐        │   │
                        │   │  │Task 1  │  │Task 2  │  │Task N  │        │   │
                        │   │  │Fargate │  │Fargate │  │Fargate │        │   │
                        │   │  │:3000   │  │:3000   │  │:3000   │        │   │
                        │   │  └────┬───┘  └────┬───┘  └────┬───┘        │   │
                        │   │       │            │            │            │   │
                        │   │       └────────────┴────────────┘           │   │
                        │   │                    │                         │   │
                        │   │                    ▼                         │   │
                        │   │  ┌──────────────────────────────────────┐   │   │
                        │   │  │  Amazon CloudWatch Logs              │   │   │
                        │   │  │  Log Group: /ecs/academy-api         │   │   │
                        │   │  └──────────────────────────────────────┘   │   │
                        │   │                                              │   │
                        │   │  ┌──────────────────────────────────────┐   │   │
                        │   │  │  Amazon ECR                          │   │   │
                        │   │  │  Repository: academy-api             │   │   │
                        │   │  │  Tags: 1.0, 1.1, 1.2, 1.3, 1.5      │   │   │
                        │   │  └──────────────────────────────────────┘   │   │
                        │   └──────────────────────────────────────────────┘   │
                        └─────────────────────────────────────────────────────┘
```

### Traffic Flow

```
Client → ALB (port 80) → Target Group (port 3000) → ECS Fargate Tasks
                                    │
                          Health Check: GET /health
                          Interval: 30s | Threshold: 2 healthy / 3 unhealthy
```

### Security Groups

```
┌─────────────────────────────────────────────────────────┐
│  academy-alb-sg                                         │
│  Inbound:  TCP 80  from 0.0.0.0/0 (internet)           │
│  Outbound: All traffic (default)                        │
└─────────────────────────────────────────────────────────┘
                          │
                          │ source group reference
                          ▼
┌─────────────────────────────────────────────────────────┐
│  academy-ecs-sg                                         │
│  Inbound:  TCP 3000 from academy-alb-sg ONLY           │
│  Outbound: All traffic (default)                        │
└─────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
docker-ecs-project/
├── Dockerfile              # Multi-stage Docker build
├── package.json            # Node.js dependencies
├── package-lock.json       # Locked dependency versions
├── task-definition.json    # ECS Fargate task definition
├── README.md               # This file
└── src/
    └── index.js            # Express API application
```

---

## What We Built

### 1. Node.js Express API
A lightweight REST API with two endpoints:
- `GET /` — HTML landing page
- `GET /health` — JSON health check response with container identity metadata

### 2. Multi-Stage Dockerfile
```dockerfile
# Stage 1 — install production dependencies only
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Stage 2 — lean production image
FROM node:18-alpine AS production
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY src/ ./src/
COPY package.json ./
USER node
EXPOSE 3000
CMD ["node", "src/index.js"]
```

### 3. AWS Infrastructure
| Resource | Name | Purpose |
|---|---|---|
| ECR Repository | academy-api | Stores Docker images |
| ECS Cluster | academy-cluster | Fargate container orchestration |
| ECS Service | academy-api-service | Maintains 5 running tasks |
| Task Definition | academy-api | Container spec (256 CPU, 512MB RAM) |
| ALB | academy-alb | Internet-facing load balancer |
| Target Group | academy-tg | Routes traffic to containers on port 3000 |
| Security Group | academy-alb-sg | Allows HTTP:80 from internet |
| Security Group | academy-ecs-sg | Allows port 3000 from ALB only |
| IAM Role | ecsTaskExecutionRole | Allows ECS to pull from ECR and write logs |
| CloudWatch Log Group | /ecs/academy-api | Container logs |

---

## Technology Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 18 (Alpine) |
| Framework | Express.js |
| Containerization | Docker (multi-stage build) |
| Image Registry | Amazon ECR |
| Container Orchestration | Amazon ECS Fargate |
| Load Balancing | AWS Application Load Balancer |
| Logging | Amazon CloudWatch Logs |
| IAM | AWS IAM (least privilege) |
| CLI | AWS CLI v2 |

---

## Setup & Deployment Guide

### Prerequisites
- Docker installed
- AWS CLI v2 configured (`aws configure`)
- An AWS account with ECR, ECS, EC2, IAM, and ELB permissions

### Step 1 — Build the Docker Image
```bash
docker build -t academy-api:1.0 .
```

### Step 2 — Authenticate to ECR and Push
```bash
ECR_URI=<account-id>.dkr.ecr.<region>.amazonaws.com

aws ecr get-login-password --region <region> | \
  docker login --username AWS --password-stdin $ECR_URI

docker tag academy-api:1.0 $ECR_URI/academy-api:1.0
docker push $ECR_URI/academy-api:1.0
```

### Step 3 — Create ECS Cluster
```bash
aws ecs create-cluster --cluster-name academy-cluster --region <region>
```

### Step 4 — Create IAM Execution Role
```bash
aws iam create-role \
  --role-name ecsTaskExecutionRole \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "ecs-tasks.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }'

aws iam attach-role-policy \
  --role-name ecsTaskExecutionRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy
```

### Step 5 — Create CloudWatch Log Group
```bash
aws logs create-log-group --log-group-name /ecs/academy-api --region <region>
```

### Step 6 — Register Task Definition
```bash
aws ecs register-task-definition \
  --cli-input-json file://task-definition.json \
  --region <region>
```

### Step 7 — Create Security Groups and ALB
```bash
# ALB security group — allow HTTP from internet
ALB_SG=$(aws ec2 create-security-group \
  --group-name academy-alb-sg \
  --description 'ALB - allow HTTP from internet' \
  --vpc-id <vpc-id> --region <region> \
  --query 'GroupId' --output text)

aws ec2 authorize-security-group-ingress \
  --group-id $ALB_SG --protocol tcp --port 80 --cidr 0.0.0.0/0 --region <region>

# ECS security group — allow port 3000 from ALB only
ECS_SG=$(aws ec2 create-security-group \
  --group-name academy-ecs-sg \
  --description 'ECS tasks - allow traffic from ALB only' \
  --vpc-id <vpc-id> --region <region> \
  --query 'GroupId' --output text)

aws ec2 authorize-security-group-ingress \
  --group-id $ECS_SG --protocol tcp --port 3000 \
  --source-group $ALB_SG --region <region>

# Create ALB
ALB_ARN=$(aws elbv2 create-load-balancer \
  --name academy-alb \
  --subnets <subnet-1> <subnet-2> <subnet-3> \
  --security-groups $ALB_SG \
  --scheme internet-facing --type application \
  --region <region> \
  --query 'LoadBalancers[0].LoadBalancerArn' --output text)

# Create target group
TG_ARN=$(aws elbv2 create-target-group \
  --name academy-tg --protocol HTTP --port 3000 \
  --vpc-id <vpc-id> --target-type ip \
  --health-check-path /health \
  --health-check-interval-seconds 30 \
  --healthy-threshold-count 2 \
  --unhealthy-threshold-count 3 \
  --region <region> \
  --query 'TargetGroups[0].TargetGroupArn' --output text)

# Create listener
aws elbv2 create-listener \
  --load-balancer-arn $ALB_ARN --protocol HTTP --port 80 \
  --default-actions Type=forward,TargetGroupArn=$TG_ARN \
  --region <region>
```

### Step 8 — Create ECS Service
```bash
aws ecs create-service \
  --cluster academy-cluster \
  --service-name academy-api-service \
  --task-definition academy-api:1 \
  --desired-count 5 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={
    subnets=[<subnet-1>,<subnet-2>,<subnet-3>],
    securityGroups=[$ECS_SG],
    assignPublicIp=ENABLED
  }" \
  --load-balancers "[{
    \"targetGroupArn\": \"$TG_ARN\",
    \"containerName\": \"academy-api\",
    \"containerPort\": 3000
  }]" \
  --region <region>
```

---

## Update Workflow

Zero-downtime rolling deployment process:

```bash
# 1. Make code changes to src/index.js

# 2. Build new image with incremented tag
docker build -t academy-api:1.x .

# 3. Push to ECR
docker tag academy-api:1.x $ECR_URI/academy-api:1.x
docker push $ECR_URI/academy-api:1.x

# 4. Update task-definition.json image tag, then register new revision
aws ecs register-task-definition \
  --cli-input-json file://task-definition.json --region <region>

# 5. Update service — ECS performs rolling update automatically
aws ecs update-service \
  --cluster academy-cluster \
  --service academy-api-service \
  --task-definition academy-api:<new-revision> \
  --region <region>
```

ECS rolling update behaviour:
- Starts new tasks with the updated image
- Waits for new tasks to pass ALB health checks
- Drains connections from old tasks
- Stops old tasks — no downtime

---

## API Endpoints

### `GET /`
Returns an HTML landing page.

### `GET /health`
Returns a JSON object identifying the container serving the request:

```json
{
  "status": "ok",
  "version": "1.4.0",
  "environment": "production",
  "targetGroup": "academy-tg",
  "message": "Welcome on board! Stanley API is live on AWS ECS!",
  "host": "ip-172-31-47-60.eu-north-1.compute.internal",
  "taskId": "ae0c34c9fdad4a399d40a44ecdb39341",
  "containerId": "ip-172-31-47-60"
}
```

| Field | Source | Purpose |
|---|---|---|
| `version` | `APP_VERSION` env var | Identifies deployed app version |
| `environment` | `ENVIRONMENT` env var | Identifies deployment environment |
| `targetGroup` | `TARGET_GROUP` env var | Identifies which ALB target group |
| `host` | `os.hostname()` | Container's internal DNS name |
| `taskId` | ECS metadata endpoint | Unique ECS task identifier |
| `containerId` | `os.hostname()` | Short container hostname |

---

## Learning Curves & Challenges

### 1. Missing `package-lock.json`
`npm ci` requires a lockfile to guarantee reproducible installs. Running `npm install` locally first generates `package-lock.json` which must be committed alongside `package.json`.

**Lesson:** Always commit `package-lock.json`. Use `npm ci` in Docker/CI, `npm install` locally.

### 2. Region Consistency
Multiple errors occurred from mixing `us-east-1` and `eu-north-1` across commands — VPC IDs, security groups, and ECR URIs are all region-scoped.

**Lesson:** Set region as a shell variable at the start of every session and reference it consistently.

### 3. `package.json` Location
The file was inside `src/` instead of the project root. Docker's build context looks for files relative to the Dockerfile location.

**Lesson:** Understand Docker's build context — files must exist at the path specified in `COPY` instructions relative to the build context root.

### 4. ECR Immutable Tags
Once a tag is pushed to ECR with immutability enabled, it cannot be overwritten. Attempting to push `1.4` again failed.

**Lesson:** Always increment image tags for each build. Never reuse tags in production — immutability is a security feature that prevents accidental overwrites.

### 5. ECS Task Metadata for Container Identity
Extracting the real ECS task ID required fetching from the `ECS_CONTAINER_METADATA_URI_V4` endpoint at runtime — a Fargate-injected environment variable pointing to a local HTTP metadata service.

**Lesson:** ECS Fargate injects `ECS_CONTAINER_METADATA_URI_V4` automatically. Use it to get task ARN, cluster, container ID, and resource limits at runtime.

### 6. Security Group Layering
Directly exposing ECS tasks to the internet is a security risk. The correct pattern is ALB SG → ECS SG with source group reference, ensuring only the ALB can reach the containers.

**Lesson:** Never open ECS task ports to `0.0.0.0/0`. Always restrict inbound to the ALB security group using source group references.

### 7. Multi-Stage Docker Builds
Using a builder stage to install dependencies and copying only `node_modules` to the production stage keeps the final image lean — no build tools, no dev dependencies.

**Lesson:** Multi-stage builds reduce image size and attack surface. The production image only contains what's needed to run the app.

---

## What We Achieved

| Goal | Status |
|---|---|
| Containerized Node.js app with multi-stage Dockerfile | ✅ |
| Pushed image to Amazon ECR | ✅ |
| Deployed to ECS Fargate with 5 running tasks | ✅ |
| Internet-facing ALB routing traffic across all tasks | ✅ |
| ALB health checks on `/health` endpoint | ✅ |
| Security groups restricting traffic (ALB → ECS only) | ✅ |
| Container logs streaming to CloudWatch | ✅ |
| Each container uniquely identifiable via task ID | ✅ |
| Zero-downtime rolling deployments | ✅ |
| Environment and version metadata per container | ✅ |

---

## Author

Stanley — Borderless Tech Academy DevOps Programme
