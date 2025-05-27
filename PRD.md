# PRD: VerifAI - AI-Powered Mobile Sanity Testing Agent

## 1. Executive Summary

This document outlines the development of VerifAI, an AI-powered mobile sanity testing agent that automates Android application testing using natural language instructions. The system integrates with CI/CD pipelines to perform automated sanity checks on mobile applications and updates JIRA tickets with test results.

## 2. Project Overview

### 2.1 Purpose

Create an intelligent agent that:

- Receives testing requests via API when PRs are raised
- Downloads APKs and test instructions automatically
- Performs mobile app testing using AI-driven automation
- Updates JIRA tickets with comprehensive test results

### 2.2 Key Technologies

- **AI/ML**: Amazon Bedrock for natural language processing
- **Mobile Automation**: Mobile-MCP server for device interaction
- **Integration**: JIRA MCP for ticket management
- **Infrastructure**: Node.js/TypeScript, Docker-ready architecture

## 3. System Architecture

### 3.1 High-Level Architecture

```
Service A (CI/CD) → API Endpoint → Test Orchestrator
                                        ↓
                              Local AI Client (Claude CLI)
                                   ↓         ↓
                            Mobile-MCP   JIRA MCP
                                ↓           ↓
                        Android Emulator  JIRA API

                    Amazon Bedrock (for instruction analysis)
                                ↑
                        Test Orchestrator
```

### 3.2 Architecture Notes

- **Amazon Bedrock**: Used for natural language processing and instruction analysis (cloud-based API)
- **Local AI Client**: Claude CLI or similar MCP-compatible client (Bedrock doesn't provide MCP client)
- **Mobile-MCP**: Runs locally with access to Android emulator
- **JIRA MCP**: Handles JIRA ticket updates
- **Test Orchestrator**: Coordinates between all components

### 3.3 MCP Integration Pattern

```typescript
// Hybrid approach (Recommended for AWS Hackathon):
1. Amazon Bedrock analyzes and parses test instructions via API
2. Test Orchestrator translates Bedrock output to structured commands
3. Local Claude CLI executes commands via Mobile-MCP and JIRA MCP
4. Results flow back through the orchestrator

// Alternative: Pure Local MCP
1. Skip Bedrock, use Claude CLI directly with MCP servers
2. Send raw instructions to Claude for processing and execution
3. Claude handles both analysis and execution via MCP

// Custom Option: Build MCP Bridge
1. Create custom MCP client that uses Bedrock backend
2. Implement MCP protocol with Bedrock as the AI engine
3. Direct integration with Mobile-MCP and JIRA MCP
```

### 3.4 Core Components

1. **API Server**: Express.js REST API
2. **Test Orchestrator**: Main business logic coordinator and MCP bridge
3. **Local AI Client**: Claude CLI or compatible MCP client
4. **Emulator Manager**: Android emulator lifecycle management
5. **AI Processor**: Amazon Bedrock integration for instruction analysis
6. **Mobile-MCP Server**: Local server for mobile automation
7. **JIRA MCP Server**: Local server for JIRA integration
8. **File Manager**: APK and instruction file handling

## 4. API Contract

### 4.1 Endpoint Specification

**POST** `/api/v1/sanity-test`

**Request Headers:**

```
Content-Type: application/json
X-API-Key: <api-key>
```

**Request Body:**

```json
{
  "jiraTicketId": "PROJ-1234",
  "commitSha": "a1b2c3d4e5f6789",
  "repositoryUrl": "https://github.com/org/repo",
  "testInstructionsUrl": "https://s3.amazonaws.com/bucket/test-instructions.txt",
  "metadata": {
    "prNumber": 123,
    "branch": "feature/fix-todo-duplication",
    "author": "developer@company.com"
  }
}
```

**Response:**

```json
{
  "success": true,
  "testRunId": "uuid-test-run-id",
  "message": "Sanity test initiated successfully",
  "estimatedDuration": "5-10 minutes"
}
```

## 5. Test Instruction Format

### 5.1 Standardized Format

```
# Test Instructions Format v1.0

## Test Metadata
- Test ID: SANITY_001
- App: Todo Application
- Feature: Add Todo Item
- Bug Fix: Prevent duplicate todo creation

## Prerequisites
- App should be installed and launched
- No existing todos in the list
- Device in portrait orientation

## Test Steps
1. LAUNCH_APP: com.example.todoapp
2. WAIT_FOR_ELEMENT: id=main_screen, timeout=5s
3. VERIFY_ELEMENT_COUNT: xpath=//android.widget.TextView[@text='No todos yet'], expected=1
4. TAP_ELEMENT: id=add_todo_button
5. WAIT_FOR_ELEMENT: id=todo_input_field, timeout=3s
6. TYPE_TEXT: id=todo_input_field, text="Buy groceries"
7. TAP_ELEMENT: id=save_todo_button
8. WAIT_FOR_ELEMENT: xpath=//android.widget.TextView[@text='Buy groceries'], timeout=5s
9. VERIFY_ELEMENT_COUNT: xpath=//android.widget.TextView[@text='Buy groceries'], expected=1
10. TAKE_SCREENSHOT: final_state

## Expected Output
- Single todo item "Buy groceries" should be visible in the list
- No duplicate entries should be created
- Todo counter should show "1 item"
- Screenshot should show exactly one todo item in the list

## Success Criteria
- All verification steps pass
- No duplicate todos are created when add button is pressed once
- App remains stable throughout the test
```

### 5.2 Instruction Grammar

```
ACTION_TYPE: target_selector[, parameter=value]*

Supported Actions:
- LAUNCH_APP: package_name
- TAP_ELEMENT: selector
- TYPE_TEXT: selector, text=string
- WAIT_FOR_ELEMENT: selector, timeout=duration
- VERIFY_ELEMENT_COUNT: selector, expected=number
- VERIFY_TEXT: selector, expected=string
- TAKE_SCREENSHOT: name
- SCROLL: direction=up|down|left|right
- SWIPE: from_selector, to_selector
```

## 6. Implementation Plan

### Phase 1: Core Infrastructure (Week 1)

- Set up Node.js/TypeScript project structure
- Implement API server with authentication
- Create emulator manager for Android lifecycle
- Set up logging and error handling framework

### Phase 2: Mobile Integration (Week 2)

- Integrate Mobile-MCP server
- Implement test instruction parser
- Create test executor with basic actions
- Add screenshot and logging capabilities

### Phase 3: AI Integration (Week 3)

- Integrate Amazon Bedrock for instruction processing
- Implement intelligent error recovery
- Add natural language test result analysis
- Create adaptive test execution logic

### Phase 4: JIRA Integration (Week 4)

- Integrate JIRA MCP for ticket updates
- Implement comprehensive result reporting
- Add test artifact management
- Create notification system

### Phase 5: Testing & Optimization (Week 5)

- End-to-end testing with sample apps
- Performance optimization
- Error handling improvements
- Documentation and deployment preparation

## 7. Technical Specifications

### 7.1 Project Structure

```
verifai/
├── src/
│   ├── api/
│   │   ├── routes/
│   │   ├── middleware/
│   │   └── validators/
│   ├── core/
│   │   ├── emulator/
│   │   ├── executor/
│   │   ├── parser/
│   │   └── orchestrator/
│   ├── integrations/
│   │   ├── bedrock/
│   │   ├── jira/
│   │   └── mobile-mcp/
│   ├── utils/
│   └── types/
├── tests/
├── docs/
├── docker/
└── config/
```

### 7.2 Key Dependencies

```json
{
  "dependencies": {
    "express": "^4.18.0",
    "typescript": "^5.0.0",
    "@aws-sdk/client-bedrock-runtime": "^3.0.0",
    "@mobilenext/mobile-mcp": "latest",
    "winston": "^3.8.0",
    "joi": "^17.9.0",
    "axios": "^1.4.0",
    "uuid": "^9.0.0",
    "child_process": "built-in"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "jest": "^29.0.0"
  }
}
```

### 7.3 Environment Configuration

```env
# API Configuration
API_PORT=3000
API_KEY=your-secure-api-key

# AWS Configuration
AWS_REGION=us-east-1
BEDROCK_MODEL_ID=anthropic.claude-3-sonnet-20240229-v1:0

# Android Configuration
ANDROID_HOME=/path/to/android-sdk
EMULATOR_NAME=test_emulator_api_30

# JIRA Configuration
JIRA_BASE_URL=https://company.atlassian.net
JIRA_EMAIL=bot@company.com
JIRA_API_TOKEN=your-jira-token
```

### 7.3 MCP Setup Requirements

```bash
# Install Claude CLI for MCP support
npm install -g @anthropic-ai/claude-cli

# Install MCP servers
npm install -g @mobilenext/mobile-mcp
npm install -g @atlassian/jira-mcp

# Configure MCP servers in Claude config
# ~/.config/claude/mcp_settings.json
{
  "mcpServers": {
    "mobile-mcp": {
      "command": "npx",
      "args": ["-y", "@mobilenext/mobile-mcp@latest"]
    },
    "jira-mcp": {
      "command": "npx",
      "args": ["-y", "@atlassian/jira-mcp@latest"]
    }
  }
}
```

## 8. Success Metrics

### 8.1 Performance Metrics

- Test execution time: < 10 minutes per sanity run
- API response time: < 2 seconds for test initiation
- Emulator startup time: < 60 seconds
- Success rate: > 95% for valid test instructions

### 8.2 Quality Metrics

- Test accuracy: > 98% correct identification of UI elements
- False positive rate: < 2%
- Error recovery rate: > 90% for transient failures
- JIRA update success rate: > 99%

## 9. Risk Assessment

### 9.1 Technical Risks

- **Mobile-MCP stability**: Mitigation through comprehensive error handling
- **Emulator reliability**: Mitigation through automated restart mechanisms
- **AI instruction parsing**: Mitigation through structured format validation

### 9.2 Integration Risks

- **JIRA API limits**: Mitigation through rate limiting and retry logic
- **GitHub API reliability**: Mitigation through fallback mechanisms
- **S3 access issues**: Mitigation through proper error handling

## 10. Future Enhancements

### 10.1 Short-term (3-6 months)

- Support for iOS testing
- Parallel test execution
- Advanced AI-driven test generation
- Integration with additional CI/CD platforms

### 10.2 Long-term (6-12 months)

- Visual regression testing
- Performance testing capabilities
- Multi-device testing support
- Machine learning-based test optimization

## 11. Deliverables

1. **Core Application**: Fully functional testing agent
2. **API Documentation**: Comprehensive API specification
3. **Deployment Guide**: Docker containerization and deployment instructions
4. **Test Suite**: Unit and integration tests
5. **Monitoring Dashboard**: Basic logging and metrics collection
6. **User Manual**: Instructions for setup and usage

## 12. Requirements Summary

### 12.1 Functional Requirements

- **FR-001**: System shall accept API requests with JIRA ticket ID, commit SHA, repository URL, and test instructions URL
- **FR-002**: System shall authenticate requests using API key-based authentication
- **FR-003**: System shall download APK files from GitHub releases using commit SHA
- **FR-004**: System shall download test instructions from S3 using pre-signed URLs
- **FR-005**: System shall manage Android emulator lifecycle (start, stop, reset)
- **FR-006**: System shall execute test instructions using Mobile-MCP integration
- **FR-007**: System shall use Amazon Bedrock for AI-powered instruction processing
- **FR-008**: System shall capture screenshots and logs during test execution
- **FR-009**: System shall update JIRA tickets with test results, status, and artifacts
- **FR-010**: System shall handle test failures and report detailed error information

### 12.2 Non-Functional Requirements

- **NFR-001**: System shall respond to API requests within 2 seconds
- **NFR-002**: System shall complete sanity tests within 10 minutes
- **NFR-003**: System shall maintain 95% uptime during operation
- **NFR-004**: System shall support concurrent test execution (future enhancement)
- **NFR-005**: System shall provide structured logging for debugging and monitoring
- **NFR-006**: System shall be containerizable for future deployment flexibility

### 12.3 Integration Requirements

- **IR-001**: Integration with Mobile-MCP server for mobile automation
- **IR-002**: Integration with Amazon Bedrock for AI processing
- **IR-003**: Integration with JIRA MCP for ticket management
- **IR-004**: Integration with GitHub API for APK downloads
- **IR-005**: Integration with AWS S3 for test instruction retrieval

This PRD provides a comprehensive roadmap for building the AI-powered mobile sanity testing agent, leveraging Amazon Bedrock for intelligent test execution and ensuring seamless integration with existing CI/CD workflows.
