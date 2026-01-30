# kse-spec-templates

Official template library for [kiro-spec-engine (kse)](https://github.com/heguangyong/kiro-spec-engine).

This repository contains high-quality, community-contributed Spec templates to help you quickly create well-structured feature specifications.

## 🚀 Quick Start

```bash
# List available templates
kse templates list

# Search for templates
kse templates search "api"

# Create a new Spec from a template
kse spec create my-feature --template web-features/rest-api

# Update your local template cache
kse templates update
```

## 📁 Template Categories

- **web-features/** - Frontend and web application features
- **backend-features/** - Backend services and APIs
- **infrastructure/** - Infrastructure and deployment
- **devops/** - DevOps and CI/CD pipelines
- **testing/** - Testing frameworks and strategies

## 🎯 Available Templates

### Web Features
- `rest-api` - RESTful API endpoints with validation and error handling ✅
- `graphql-api` - GraphQL API with schema and resolvers ✅

### Backend Features
- `database-integration` - Database schema and migrations ✅

### Coming Soon
- `web-features/file-upload` - File upload with validation and storage
- `backend-features/caching-layer` - Caching strategy with Redis/Memcached
- `backend-features/message-queue` - Message queue integration
- `infrastructure/ci-cd-pipeline` - Continuous integration and deployment
- `infrastructure/monitoring-setup` - Application monitoring and alerting
- `infrastructure/deployment-automation` - Automated deployment workflows

## 📝 Template Format

Each template consists of three files with YAML frontmatter:

```
template-name/
├── requirements.md    # Feature requirements and acceptance criteria
├── design.md          # Technical design and architecture
└── tasks.md           # Implementation tasks breakdown
```

### Example Frontmatter

```yaml
---
name: REST API Feature
category: web-features
description: Template for creating RESTful API endpoints
difficulty: intermediate
tags:
  - api
  - rest
  - backend
applicable_scenarios:
  - Creating new API endpoints
  - Implementing CRUD operations
  - Building microservices
author: kse-team
created_at: 2025-01-30
updated_at: 2025-01-30
version: 1.0.0
---
```

## 🤝 Contributing

We welcome high-quality template contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Quick Contribution Steps

1. Fork this repository
2. Create a new template in the appropriate category
3. Follow the [template structure guidelines](CONTRIBUTING.md#template-structure)
4. Submit a pull request with the validation checklist

## 📊 Template Quality Standards

All templates must:
- ✅ Include complete frameworks for requirements, design, and tasks
- ✅ Contain clear comments and filling instructions
- ✅ Include example content demonstrating best practices
- ✅ Be validated against real projects
- ✅ Pass all validation checks

## 📖 Documentation

- [Template Usage Guide](docs/template-usage-guide.md)
- [Template Creation Guide](docs/template-creation-guide.md)
- [Contributing Guidelines](CONTRIBUTING.md)

## 📜 License

MIT License - see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

Thanks to all contributors who have shared their templates with the community!

---

**Version**: 1.0.0  
**Last Updated**: 2025-01-30  
**Maintained by**: [kse-team](https://github.com/heguangyong/kiro-spec-engine)
