# Spec Numbering Strategy Guide

> A comprehensive guide to choosing the right numbering strategy for your Specs

## Overview

Kiro Spec Engine uses a two-part numbering system: `{major}-{minor}-{description}`

- **Major number**: Represents a feature domain or theme (01, 02, 03, ...)
- **Minor number**: Represents iterations or sub-features within that domain (00, 01, 02, ...)
- **Description**: A kebab-case description of the Spec

**Examples**:
- `01-00-user-authentication`
- `01-01-add-oauth-support`
- `02-00-payment-system`

## When to Use Major vs Minor Numbers

### Strategy 1: Simple Projects (Recommended for Most Cases)

**Use Case**: Projects with < 20 independent features

**Approach**: Use only major numbers with minor always as `00`

```
01-00-user-authentication
02-00-payment-integration
03-00-notification-system
04-00-reporting-dashboard
05-00-api-gateway
```

**Advantages**:
- ✅ Simple and clear
- ✅ Easy to understand at a glance
- ✅ No need to plan groupings upfront
- ✅ Works well for independent features

**When to use**:
- Building a tool or library
- Features are relatively independent
- Project is in early stages
- Team is small (< 5 people)

### Strategy 2: Complex Projects with Themes

**Use Case**: Large projects with clear feature domains

**Approach**: Group related Specs under the same major number

```
# User Management Domain (01-xx)
01-00-user-authentication-foundation
01-01-add-oauth-support
01-02-add-two-factor-auth
01-03-add-sso-integration

# Payment Domain (02-xx)
02-00-payment-system-mvp
02-01-add-subscription-billing
02-02-add-invoice-generation
02-03-add-refund-workflow

# Notification Domain (03-xx)
03-00-notification-email
03-01-notification-sms
03-02-notification-push
03-03-notification-in-app
```

**Advantages**:
- ✅ Clear thematic grouping
- ✅ Easy to track evolution of a feature
- ✅ Shows relationships between Specs
- ✅ Scales well for large projects

**When to use**:
- Building a complex application
- Features have clear domains (user, payment, notification, etc.)
- Multiple iterations expected per domain
- Large team with domain ownership

### Strategy 3: Hybrid Approach (Flexible)

**Use Case**: Start simple, add structure as needed

**Approach**: Begin with major numbers only, introduce minor numbers when needed

**Phase 1 - Early Development**:
```
01-00-mvp-core-features
02-00-user-management
03-00-data-storage
04-00-api-gateway
```

**Phase 2 - Iteration Needed**:
```
01-00-mvp-core-features
02-00-user-management
03-00-data-storage-basic
03-01-data-storage-add-caching      ← Added iteration
03-02-data-storage-add-replication  ← Added iteration
04-00-api-gateway
05-00-monitoring-system
```

**Advantages**:
- ✅ Start simple, grow as needed
- ✅ No premature planning required
- ✅ Adapts to project evolution
- ✅ Best of both worlds

**When to use**:
- Uncertain about project scope
- Want flexibility
- Agile development approach
- Learning the Spec workflow

## Semantic Numbering Rules

### Rule 1: XX-00 for First or Independent Specs

Use `XX-00` for:
- The first Spec in a domain
- Independent features that don't need iterations
- Standalone functionality

```
01-00-authentication-system    # First in domain
02-00-payment-integration      # Independent feature
03-00-email-notifications      # Standalone
```

### Rule 2: XX-01+ for Iterations and Enhancements

Use `XX-01`, `XX-02`, etc. for:
- Bug fixes related to a previous Spec
- Feature enhancements
- Iterations on the same theme
- Related functionality

```
01-00-authentication-system
01-01-fix-session-timeout-bug       # Bug fix
01-02-add-remember-me-feature       # Enhancement
01-03-add-password-reset            # Related feature
```

### Rule 3: Keep Related Specs Together

Group Specs that:
- Share the same codebase area
- Have dependencies on each other
- Belong to the same feature domain
- Will be maintained by the same team

```
# Good: Related notification features grouped
03-00-notification-email
03-01-notification-sms
03-02-notification-push

# Avoid: Unrelated features under same major number
03-00-notification-email
03-01-payment-refunds        # ❌ Not related to notifications
```

## Practical Examples

### Example 1: Tool/Library Project (kiro-spec-engine)

**Project Type**: CLI tool with independent features

**Strategy**: Simple numbering (XX-00)

```
01-00-user-space-diagnosis
02-00-oauth-api-upgrade
03-00-multi-user-collaboration
04-00-watch-mode-automation
05-00-agent-hooks-and-automation
06-00-test-stability-and-reliability
07-00-user-onboarding-and-documentation
08-00-document-lifecycle-management
09-00-document-governance-automation
```

**Why**: Each feature is independent and complete

### Example 2: E-commerce Platform

**Project Type**: Complex web application

**Strategy**: Thematic grouping

```
# User Domain
01-00-user-registration-and-login
01-01-user-profile-management
01-02-user-preferences-and-settings

# Product Domain
02-00-product-catalog-foundation
02-01-product-search-and-filters
02-02-product-recommendations

# Order Domain
03-00-shopping-cart-system
03-01-checkout-process
03-02-order-tracking
03-03-order-history

# Payment Domain
04-00-payment-gateway-integration
04-01-multiple-payment-methods
04-02-payment-security-enhancements
```

**Why**: Clear domains with multiple related features

### Example 3: SaaS Application

**Project Type**: Multi-tenant SaaS

**Strategy**: Hybrid approach

```
# Core Features (Independent)
01-00-tenant-management
02-00-user-authentication
03-00-billing-system

# Analytics Domain (Grouped)
04-00-analytics-foundation
04-01-analytics-custom-dashboards
04-02-analytics-export-reports

# Integration Domain (Grouped)
05-00-api-gateway
05-01-webhook-system
05-02-third-party-integrations

# More Independent Features
06-00-email-templates
07-00-notification-center
```

**Why**: Mix of independent features and grouped domains

## Decision Tree

Use this flowchart to decide your numbering strategy:

```
Is this your first Spec?
├─ Yes → Use 01-00-{description}
└─ No → Continue...

Is this related to an existing Spec?
├─ Yes → Use same major number, increment minor
│        Example: 01-00 exists → use 01-01
└─ No → Continue...

Do you expect multiple iterations in this domain?
├─ Yes → Plan major number for the domain
│        Example: 03-00, 03-01, 03-02 for notifications
└─ No → Use next available major number with -00
         Example: 05-00-new-feature
```

## Best Practices

### ✅ Do

1. **Start simple**: Use XX-00 until you need complexity
2. **Be consistent**: Stick to one strategy per project
3. **Document your approach**: Add a note in your project README
4. **Use descriptive names**: Make the description clear
5. **Reserve major numbers**: If planning domains, reserve ranges

### ❌ Don't

1. **Don't over-plan**: Don't create 50 major numbers upfront
2. **Don't mix unrelated features**: Keep major numbers thematic
3. **Don't skip numbers**: Use sequential numbering
4. **Don't change strategy mid-project**: Stick to your approach
5. **Don't stress**: The numbering is for organization, not perfection

## Migration Between Strategies

### From Simple to Thematic

If you started with simple numbering and need to add structure:

**Before**:
```
01-00-user-auth
02-00-user-profile
03-00-payment-basic
04-00-payment-subscriptions
```

**After** (optional reorganization):
```
01-00-user-auth
01-01-user-profile          # Grouped with auth
02-00-payment-basic
02-01-payment-subscriptions # Grouped with payment
```

**Note**: Renaming existing Specs is optional. You can keep old numbers and use new strategy going forward.

## Tool Support

Kiro Spec Engine provides commands to help with numbering:

```bash
# List all Specs with their numbers
kse status

# View Specs grouped by major number
kse workflows

# Get next available number suggestion
kse workflows --suggest-next
```

## Summary

**Choose your strategy based on project complexity**:

- **Simple projects**: Use `XX-00` for everything
- **Complex projects**: Group by domain with `XX-YY`
- **Uncertain**: Start simple, add structure later

**Remember**: The goal is organization and clarity, not perfection. Choose what works for your team and project.

---

**Related Documentation**:
- [Spec Workflow Guide](./spec-workflow.md)
- [Quick Start Guide](./quick-start.md)
- [FAQ](./faq.md)

**Version**: 1.0  
**Last Updated**: 2026-01-24
