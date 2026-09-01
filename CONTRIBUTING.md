# Contributing to MaterialBlue

Thank you for your interest in contributing to MaterialBlue! This guide will help you get started.

## Project Philosophy

MaterialBlue is designed to be:
- **Static**: No server-side code, runs entirely in the browser
- **Simple**: Focused on core Bluesky functionality, not feature bloat
- **Beautiful**: Material Design 3 aesthetics
- **Personal**: Suitable for individual/small-scale use

**Important**: We intentionally do NOT want to become a full-featured SNS client. The project's value lies in its simplicity.

## Code of Conduct

- Be respectful and inclusive
- Focus on constructive feedback
- Remember this is a personal project maintained by volunteers

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues as you might find out that you don't need to create one. When you are creating a bug report, please include as many details as possible:

* Use a clear and descriptive title
* Describe the exact steps to reproduce the problem
* Provide specific examples to demonstrate the steps
* Describe the behavior you observed and what behavior you expected
* Include screenshots if possible
* Include browser version and OS information

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. Before creating an enhancement suggestion, please check the existing issues. When creating an enhancement suggestion, please include:

* Use a clear and descriptive title
* Provide a detailed description of the suggested enhancement
* Explain why this enhancement would be useful
* List some examples of how this enhancement would be used

### Pull Requests

Before submitting a pull request, please:

1. Check that your change aligns with the project philosophy
2. Ensure your code follows the existing style
3. Test your changes thoroughly
4. Update documentation if necessary
5. Reference any related issues

#### PR Checklist

- [ ] My code follows the existing style
- [ ] I have tested my changes manually
- [ ] My changes do not break existing functionality
- [ ] I have updated documentation if needed
- [ ] My change aligns with the project's design goals

## Development Setup

### Prerequisites

- Hugo extended v0.140.0 or later
- A modern web browser
- A Bluesky account (for testing)

### Local Development

```bash
git clone https://github.com/kons10/MaterialBlue.git
cd MaterialBlue
hugo server
```

Open `http://localhost:1313` in your browser.

### Code Structure

```
static/src/
├── main.js              # Main application logic
├── bsky-client.js       # Bluesky API wrapper
├── i18n.js             # Internationalization
└── md-typescale.js     # Material Design typography
```

## Coding Guidelines

### JavaScript Style

- Use ES6+ features (const/let, arrow functions, async/await)
- Keep functions small and focused
- Add JSDoc comments for complex functions
- Prefer vanilla JavaScript over frameworks

### Commit Messages

- Use the present tense ("Add feature" not "Added feature")
- Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
- Limit the first line to 72 characters or less
- Reference issues and pull requests liberally after the first line

### Testing

Given the project's size, we rely primarily on manual testing. Before submitting a PR, please test:

- Login/logout flow
- Timeline loading and pagination
- Creating posts (text only and with images)
- Like/unlike functionality
- Repost/unrepost functionality
- Reply functionality
- Bookmark functionality
- Notification handling
- Settings operations (cache clearing, locale changes)

## Areas Needing Contribution

### High Priority

1. **Bug fixes**: See open issues labeled "bug"
2. **Documentation improvements**: Especially for non-Japanese speakers
3. **Testing**: Manual test results for various browsers

### Medium Priority

1. **Code refactoring**: Splitting `main.js` into smaller modules
2. **Accessibility improvements**: ARIA labels, keyboard navigation
3. **Performance optimization**: Reducing re-renders, optimizing queries

### Low Priority

1. **Additional locales**: Translations for other languages
2. **UI polish**: Minor visual improvements
3. **Documentation examples**: Screenshots, usage guides

## Questions?

Feel free to open an issue with the "question" label if you have any questions about contributing.

## License

By contributing to MaterialBlue, you agree that your contributions will be licensed under the Apache License 2.0.
