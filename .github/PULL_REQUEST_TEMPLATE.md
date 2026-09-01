name: Pull Request

description: Submit a pull request to MaterialBlue

body:
  - type: markdown
    attributes:
      value: |
        Thanks for your interest in contributing to MaterialBlue! Please fill out the information below to help us review your PR.

  - type: checkboxes
    id: checklist
    attributes:
      label: PR Checklist
      description: Before submitting, please confirm the following:
      options:
        - label: My code follows the existing style
          required: true
        - label: I have tested my changes manually
          required: true
        - label: My changes do not break existing functionality
          required: true
        - label: I have updated documentation if needed
          required: false
        - label: My change aligns with the project's design goals (static, simple, beautiful)
          required: true

  - type: textarea
    id: description
    attributes:
      label: Description
      description: What does this PR do?
      placeholder: Briefly describe your changes
    validations:
      required: true

  - type: textarea
    id: motivation
    attributes:
      label: Motivation
      description: Why is this change needed?
      placeholder: Explain the problem this solves
    validations:
      required: true

  - type: textarea
    id: testing
    attributes:
      label: Testing Done
      description: How did you test this change?
      placeholder: Describe your testing process
    validations:
      required: true

  - type: input
    id: related-issue
    attributes:
      label: Related Issue
      description: Link to any related issue(s)
      placeholder: "#123"

  - type: dropdown
    id: change-type
    attributes:
      label: Type of Change
      description: What type of change is this?
      options:
        - Bug fix
        - New feature
        - Documentation update
        - Code refactoring
        - Performance improvement
        - Other (please describe)
    validations:
      required: true

  - type: textarea
    id: additional-context
    attributes:
      label: Additional Context
      description: Any other information that would be helpful
      placeholder: Screenshots, related discussions, etc.
