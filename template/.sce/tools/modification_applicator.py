#!/usr/bin/env python3
"""
Modification Applicator - 修改应用组件

负责将识别的改进应用到文档中，同时保持现有内容和结构
"""

import re
from typing import List, Tuple, Optional
from dataclasses import dataclass


@dataclass
class ModificationResult:
    """修改结果"""
    modified_content: str
    applied_improvements: List = None
    failed_improvements: List[Tuple] = None
    modification_report: str = ""
    
    def __post_init__(self):
        if self.applied_improvements is None:
            self.applied_improvements = []
        if self.failed_improvements is None:
            self.failed_improvements = []


class ModificationApplicator:
    """
    修改应用器 - 应用文档改进
    
    保持内容完整性和格式一致性
    """
    
    def __init__(self):
        self.language = 'en'

    def apply_requirements_improvements(self, content: str, improvements: List, language: str = 'en') -> ModificationResult:
        """应用 Requirements 改进 - 增强版，真正修改文档"""
        self.language = language
        modified_content = content
        applied = []
        failed = []
        
        # 按优先级排序改进
        improvements_sorted = sorted(improvements, key=lambda x: (
            0 if x.priority.value == 'high' else 1 if x.priority.value == 'medium' else 2
        ))
        
        for improvement in improvements_sorted:
            try:
                # 根据改进类型应用不同的修改策略
                if improvement.type.value == "add_section":
                    result = self._add_section_to_requirements(modified_content, improvement, language)
                    if result != modified_content:
                        modified_content = result
                        applied.append(improvement)
                
                elif improvement.type.value == "add_nfr":
                    result = self._add_nfr_section(modified_content, improvement, language)
                    if result != modified_content:
                        modified_content = result
                        applied.append(improvement)
                
                elif improvement.type.value == "enhance_criteria":
                    result = self._enhance_acceptance_criteria(modified_content, improvement, language)
                    if result != modified_content:
                        modified_content = result
                        applied.append(improvement)
                
                elif improvement.type.value == "add_error_handling":
                    result = self._add_error_handling_requirements(modified_content, improvement, language)
                    if result != modified_content:
                        modified_content = result
                        applied.append(improvement)
                
                elif improvement.type.value == "add_edge_cases":
                    result = self._add_edge_case_criteria(modified_content, improvement, language)
                    if result != modified_content:
                        modified_content = result
                        applied.append(improvement)
                
                elif improvement.type.value == "add_glossary_term":
                    result = self._add_glossary_section(modified_content, improvement, language)
                    if result != modified_content:
                        modified_content = result
                        applied.append(improvement)
                
            except Exception as e:
                failed.append((improvement, e))
        
        report = self._generate_modification_report(applied, failed, language)
        
        return ModificationResult(
            modified_content=modified_content,
            applied_improvements=applied,
            failed_improvements=failed,
            modification_report=report
        )
    
    def apply_design_improvements(self, content: str, improvements: List, requirements_content: str, language: str = 'en') -> ModificationResult:
        """应用 Design 改进 - 增强版，真正修改文档"""
        self.language = language
        modified_content = content
        applied = []
        failed = []
        
        # 按优先级排序改进
        improvements_sorted = sorted(improvements, key=lambda x: (
            0 if x.priority.value == 'high' else 1 if x.priority.value == 'medium' else 2
        ))
        
        for improvement in improvements_sorted:
            try:
                if improvement.type.value == "add_section":
                    result = self._add_section_to_design(modified_content, improvement, language)
                    if result != modified_content:
                        modified_content = result
                        applied.append(improvement)
                
                elif improvement.type.value == "add_diagram":
                    result = self._add_architecture_diagram(modified_content, improvement, language)
                    if result != modified_content:
                        modified_content = result
                        applied.append(improvement)
                
                elif improvement.type.value == "add_rationale":
                    result = self._add_technology_stack(modified_content, improvement, language)
                    if result != modified_content:
                        modified_content = result
                        applied.append(improvement)
                
                elif improvement.type.value == "add_component_detail":
                    result = self._add_component_details(modified_content, improvement, language)
                    if result != modified_content:
                        modified_content = result
                        applied.append(improvement)
                
                elif improvement.type.value == "add_traceability":
                    result = self._add_requirements_traceability(modified_content, improvement, requirements_content, language)
                    if result != modified_content:
                        modified_content = result
                        applied.append(improvement)
                
                elif improvement.type.value == "add_properties":
                    result = self._add_correctness_properties(modified_content, improvement, language)
                    if result != modified_content:
                        modified_content = result
                        applied.append(improvement)
                
            except Exception as e:
                failed.append((improvement, e))
        
        report = self._generate_modification_report(applied, failed, language)
        
        return ModificationResult(
            modified_content=modified_content,
            applied_improvements=applied,
            failed_improvements=failed,
            modification_report=report
        )
    
    # ==================== Requirements 修改方法 ====================
    
    def _add_section_to_requirements(self, content: str, improvement, language: str) -> str:
        """智能添加章节到 Requirements 文档"""
        section_name = improvement.target_section
        template = self._get_template(improvement.template or section_name, language)
        
        if not template:
            return content
        
        # 检查章节是否已存在
        if section_name in content or (language == 'en' and section_name.lower() in content.lower()):
            return content
        
        # 找到合适的插入位置
        if section_name in ["概述", "Introduction", "Overview"]:
            # 在文档开头插入（在标题后）
            lines = content.split('\n')
            insert_pos = 0
            for i, line in enumerate(lines):
                if line.startswith('# '):
                    insert_pos = i + 1
                    break
            lines.insert(insert_pos, '\n' + template)
            return '\n'.join(lines)
        
        elif section_name in ["约束条件", "Constraints"]:
            # 在文档末尾添加
            return content.rstrip() + '\n\n' + template
        
        else:
            # 在文档末尾添加
            return content.rstrip() + '\n\n' + template
    
    def _add_nfr_section(self, content: str, improvement, language: str) -> str:
        """添加或补充非功能需求章节"""
        # 检查是否已有非功能需求章节
        if "## 4. 非功能需求" in content or "## Non-functional Requirements" in content:
            # 已有章节，补充内容
            return self._append_to_nfr_section(content, improvement, language)
        else:
            # 添加新章节
            template = self._get_nfr_template(language)
            return content.rstrip() + '\n\n' + template
    
    def _append_to_nfr_section(self, content: str, improvement, language: str) -> str:
        """向现有非功能需求章节补充内容"""
        missing_nfr = improvement.metadata.get('missing_nfr', [])
        if not missing_nfr:
            return content
        
        # 找到非功能需求章节的位置
        nfr_pattern = r'(## (?:4\. )?非功能需求|## Non-functional Requirements)'
        match = re.search(nfr_pattern, content, re.IGNORECASE)
        if not match:
            return content
        
        # 找到下一个二级标题的位置
        next_section = re.search(r'\n## ', content[match.end():])
        if next_section:
            insert_pos = match.end() + next_section.start()
        else:
            insert_pos = len(content)
        
        # 生成补充内容
        additions = []
        for nfr in missing_nfr[:3]:  # 最多补充3个
            if language == 'zh':
                additions.append(f"\n### {nfr}\n- 待补充具体{nfr}要求\n")
            else:
                additions.append(f"\n### {nfr.title()} Requirements\n- To be specified\n")
        
        new_content = content[:insert_pos] + ''.join(additions) + content[insert_pos:]
        return new_content
    
    def _enhance_acceptance_criteria(self, content: str, improvement, language: str) -> str:
        """增强验收标准 - 添加 EARS 格式示例"""
        # 找到第一个需求章节
        req_pattern = r'(### (?:Requirement )?\d+\.\d+[^\n]*\n)'
        match = re.search(req_pattern, content)
        if not match:
            return content
        
        # 在第一个需求后添加示例验收标准
        insert_pos = match.end()
        
        if language == 'zh':
            example = """
**验收标准**:
1. WHEN 用户执行操作 THEN 系统应该返回预期结果
2. WHEN 输入无效数据 THEN 系统应该显示错误提示
"""
        else:
            example = """
#### Acceptance Criteria
1. WHEN the user performs an action THEN THE system SHALL return the expected result
2. WHEN invalid data is provided THEN THE system SHALL display an error message
"""
        
        new_content = content[:insert_pos] + example + content[insert_pos:]
        return new_content
    
    def _add_error_handling_requirements(self, content: str, improvement, language: str) -> str:
        """添加错误处理需求"""
        template = self._get_error_handling_template(language)
        
        # 在功能需求章节后添加
        if language == 'zh':
            pattern = r'(## 3\. 功能需求.*?)(\n## |\Z)'
        else:
            pattern = r'(## (?:Functional )?Requirements.*?)(\n## |\Z)'
        
        match = re.search(pattern, content, re.DOTALL)
        if match:
            insert_pos = match.end(1)
            new_content = content[:insert_pos] + '\n\n' + template + content[insert_pos:]
            return new_content
        
        return content.rstrip() + '\n\n' + template
    
    def _add_edge_case_criteria(self, content: str, improvement, language: str) -> str:
        """添加边界条件验收标准"""
        # 找到第一个验收标准章节
        if language == 'zh':
            pattern = r'(\*\*验收标准\*\*:.*?)(\n### |\n## |\Z)'
        else:
            pattern = r'(#### Acceptance Criteria.*?)(\n### |\n## |\Z)'
        
        match = re.search(pattern, content, re.DOTALL)
        if not match:
            return content
        
        insert_pos = match.end(1)
        
        if language == 'zh':
            addition = "\n- WHEN 输入为空值 THEN 系统应该处理空值情况\n- WHEN 输入达到最大限制 THEN 系统应该正确处理边界值"
        else:
            addition = "\n- WHEN input is empty THEN THE system SHALL handle empty values\n- WHEN input reaches maximum limit THEN THE system SHALL handle boundary values correctly"
        
        new_content = content[:insert_pos] + addition + content[insert_pos:]
        return new_content
    
    def _add_glossary_section(self, content: str, improvement, language: str) -> str:
        """添加术语表章节"""
        template = self._get_glossary_template(language)
        
        # 在 Introduction 后添加
        if language == 'zh':
            pattern = r'(## (?:1\. )?概述.*?)(\n## |\Z)'
        else:
            pattern = r'(## (?:Introduction|Overview).*?)(\n## |\Z)'
        
        match = re.search(pattern, content, re.DOTALL | re.IGNORECASE)
        if match:
            insert_pos = match.end(1)
            new_content = content[:insert_pos] + '\n\n' + template + content[insert_pos:]
            return new_content
        
        return content.rstrip() + '\n\n' + template
    
    # ==================== Design 修改方法 ====================
    
    def _add_section_to_design(self, content: str, improvement, language: str) -> str:
        """智能添加章节到 Design 文档"""
        section_name = improvement.target_section
        template = self._get_template(improvement.template or section_name, language)
        
        if not template:
            return content
        
        # 检查章节是否已存在
        if section_name in content:
            return content
        
        # 在文档末尾添加
        return content.rstrip() + '\n\n' + template
    
    def _add_architecture_diagram(self, content: str, improvement, language: str) -> str:
        """添加架构图"""
        template = self._get_architecture_diagram_template(language)
        
        # 在架构设计章节后添加
        if language == 'zh':
            pattern = r'(## (?:2\. )?架构设计.*?)(\n### |\n## |\Z)'
        else:
            pattern = r'(## (?:System )?Architecture.*?)(\n### |\n## |\Z)'
        
        match = re.search(pattern, content, re.DOTALL | re.IGNORECASE)
        if match:
            insert_pos = match.end(1)
            new_content = content[:insert_pos] + '\n\n' + template + content[insert_pos:]
            return new_content
        
        return content.rstrip() + '\n\n' + template
    
    def _add_technology_stack(self, content: str, improvement, language: str) -> str:
        """添加技术栈说明"""
        template = self._get_technology_stack_template(language)
        return content.rstrip() + '\n\n' + template
    
    def _add_component_details(self, content: str, improvement, language: str) -> str:
        """添加组件详细信息"""
        # 找到组件设计章节
        if language == 'zh':
            pattern = r'(## (?:3\. )?组件设计.*?)(\n## |\Z)'
        else:
            pattern = r'(## Components.*?)(\n## |\Z)'
        
        match = re.search(pattern, content, re.DOTALL | re.IGNORECASE)
        if not match:
            return content
        
        insert_pos = match.end(1)
        
        # 添加示例组件
        if language == 'zh':
            addition = """

### 3.1 核心组件

**职责**: 处理核心业务逻辑

**接口定义**:
```python
class CoreComponent:
    def process(self, data: dict) -> dict:
        \"\"\"处理数据\"\"\"
        pass
```

**依赖**: 无外部依赖
"""
        else:
            addition = """

### 3.1 Core Component

**Responsibility**: Handle core business logic

**Interface Definition**:
```python
class CoreComponent:
    def process(self, data: dict) -> dict:
        \"\"\"Process data\"\"\"
        pass
```

**Dependencies**: No external dependencies
"""
        
        new_content = content[:insert_pos] + addition + content[insert_pos:]
        return new_content
    
    def _add_requirements_traceability(self, content: str, improvement, requirements_content: str, language: str) -> str:
        """添加需求追溯"""
        # 找到第一个组件章节
        pattern = r'(### \d+\.\d+ [^\n]+\n)'
        match = re.search(pattern, content)
        if not match:
            return content
        
        insert_pos = match.end()
        
        # 添加追溯注释
        addition = "\n**Validates: Requirements 1.1, 1.2**\n"
        
        new_content = content[:insert_pos] + addition + content[insert_pos:]
        return new_content
    
    def _add_correctness_properties(self, content: str, improvement, language: str) -> str:
        """添加正确性属性章节"""
        template = self._get_correctness_properties_template(language)
        return content.rstrip() + '\n\n' + template
    
    # ==================== 模板方法 ====================
    
    def _get_template(self, template_name: str, language: str) -> str:
        """获取模板内容"""
        templates = {
            'introduction_zh': """## 1. 概述

本文档描述了系统的需求规格说明。

### 1.1 项目背景
[待补充项目背景信息]

### 1.2 项目目标
[待补充项目目标]
""",
            'introduction_en': """## Introduction

This document describes the system requirements specification.

### Project Background
[To be filled with project background information]

### Project Goals
[To be filled with project goals]
""",
            'overview_zh': """## 1. 系统概述

本设计文档描述了系统的架构和组件设计。

### 1.1 设计目标
- 模块化设计，易于维护和扩展
- 高性能，满足业务需求
- 安全可靠，保障数据安全

### 1.2 设计方法
采用分层架构，将系统划分为表示层、业务逻辑层和数据访问层。
""",
            'overview_en': """## Overview

This design document describes the system architecture and component design.

### Design Goals
- Modular design for easy maintenance and extension
- High performance to meet business requirements
- Secure and reliable to ensure data safety

### Design Approach
Adopts layered architecture, dividing the system into presentation layer, business logic layer, and data access layer.
""",
            'architecture_zh': """## 2. 架构设计

### 2.1 系统架构

系统采用三层架构设计：

```mermaid
graph TB
    A[表示层] --> B[业务逻辑层]
    B --> C[数据访问层]
    C --> D[数据存储]
```

### 2.2 架构说明
- **表示层**: 负责用户界面和交互
- **业务逻辑层**: 处理核心业务逻辑
- **数据访问层**: 封装数据库操作
""",
            'architecture_en': """## Architecture

### System Architecture

The system adopts a three-tier architecture:

```mermaid
graph TB
    A[Presentation Layer] --> B[Business Logic Layer]
    B --> C[Data Access Layer]
    C --> D[Data Storage]
```

### Architecture Description
- **Presentation Layer**: Handles user interface and interaction
- **Business Logic Layer**: Processes core business logic
- **Data Access Layer**: Encapsulates database operations
""",
            'components_zh': """## 3. 组件设计

### 3.1 组件概述
系统包含以下核心组件：
- 用户管理组件
- 数据处理组件
- 接口服务组件
""",
            'components_en': """## Components

### Component Overview
The system includes the following core components:
- User Management Component
- Data Processing Component
- Interface Service Component
"""
        }
        
        return templates.get(template_name, '')
    
    def _get_nfr_template(self, language: str) -> str:
        """获取非功能需求模板"""
        if language == 'zh':
            return """## 4. 非功能需求

### 4.1 性能需求
- 系统响应时间应小于 2 秒
- 支持并发用户数不少于 100

### 4.2 安全需求
- 用户数据必须加密存储
- 实施访问控制和身份验证

### 4.3 可用性需求
- 系统可用性应达到 99.9%
- 提供友好的用户界面

### 4.4 可维护性需求
- 代码应遵循编码规范
- 提供完整的技术文档
"""
        else:
            return """## Non-functional Requirements

### Performance Requirements
- System response time should be less than 2 seconds
- Support at least 100 concurrent users

### Security Requirements
- User data must be encrypted at rest
- Implement access control and authentication

### Usability Requirements
- System availability should reach 99.9%
- Provide user-friendly interface

### Maintainability Requirements
- Code should follow coding standards
- Provide complete technical documentation
"""
    
    def _get_error_handling_template(self, language: str) -> str:
        """获取错误处理模板"""
        if language == 'zh':
            return """### 错误处理需求

**用户故事**: 作为用户，我希望系统能够优雅地处理错误，以便我了解问题并采取相应措施。

**验收标准**:
1. WHEN 系统遇到错误 THEN 系统应该显示清晰的错误消息
2. WHEN 发生异常 THEN 系统应该记录错误日志
3. WHEN 出现致命错误 THEN 系统应该安全关闭并保存数据
"""
        else:
            return """### Error Handling Requirements

**User Story**: As a user, I want the system to handle errors gracefully, so that I understand the issue and can take appropriate action.

**Acceptance Criteria**:
1. WHEN the system encounters an error THEN THE system SHALL display a clear error message
2. WHEN an exception occurs THEN THE system SHALL log the error
3. WHEN a fatal error occurs THEN THE system SHALL shut down safely and save data
"""
    
    def _get_glossary_template(self, language: str) -> str:
        """获取术语表模板"""
        if language == 'zh':
            return """## 术语表

- **系统**: 指本文档描述的软件系统
- **用户**: 使用系统的最终用户
- **管理员**: 具有系统管理权限的用户
"""
        else:
            return """## Glossary

- **System**: The software system described in this document
- **User**: End user who uses the system
- **Administrator**: User with system administration privileges
"""
    
    def _get_architecture_diagram_template(self, language: str) -> str:
        """获取架构图模板"""
        if language == 'zh':
            return """### 系统架构图

```mermaid
graph TB
    A[用户界面] --> B[业务逻辑层]
    B --> C[数据访问层]
    C --> D[数据存储]
```
"""
        else:
            return """### System Architecture Diagram

```mermaid
graph TB
    A[User Interface] --> B[Business Logic Layer]
    B --> C[Data Access Layer]
    C --> D[Data Storage]
```
"""
    
    def _get_technology_stack_template(self, language: str) -> str:
        """获取技术栈模板"""
        if language == 'zh':
            return """## 技术选型

### 核心技术栈
- **前端**: React/Vue.js
- **后端**: Node.js/Python
- **数据库**: PostgreSQL/MongoDB
- **缓存**: Redis

### 选型理由
- 考虑团队技术栈熟悉度
- 满足性能和扩展性要求
- 社区支持和生态完善
"""
        else:
            return """## Technology Stack

### Core Technologies
- **Frontend**: React/Vue.js
- **Backend**: Node.js/Python
- **Database**: PostgreSQL/MongoDB
- **Cache**: Redis

### Selection Rationale
- Team familiarity with technology stack
- Meets performance and scalability requirements
- Strong community support and ecosystem
"""
    
    def _get_correctness_properties_template(self, language: str) -> str:
        """获取正确性属性模板"""
        if language == 'zh':
            return """## 正确性属性

### 属性 1: 数据一致性
*对于任何*数据操作，操作完成后数据应保持一致状态。

**验证**: Requirements 1.1, 1.2

### 属性 2: 操作幂等性
*对于任何*幂等操作，多次执行应产生相同结果。

**验证**: Requirements 2.1
"""
        else:
            return """## Correctness Properties

### Property 1: Data Consistency
*For any* data operation, data should remain in a consistent state after the operation completes.

**Validates**: Requirements 1.1, 1.2

### Property 2: Operation Idempotency
*For any* idempotent operation, multiple executions should produce the same result.

**Validates**: Requirements 2.1
"""
    
    def _generate_modification_report(self, applied: List, failed: List[Tuple], language: str) -> str:
        """生成修改报告"""
        if language == 'zh':
            report = f"### 修改报告\n\n"
            report += f"- 成功应用: {len(applied)} 项改进\n"
            report += f"- 失败: {len(failed)} 项改进\n\n"
            
            if applied:
                report += "#### 已应用的改进:\n"
                for imp in applied:
                    report += f"- [{imp.priority.value.upper()}] {imp.description}\n"
            
            if failed:
                report += "\n#### 失败的改进:\n"
                for imp, error in failed:
                    report += f"- {imp.description}: {str(error)}\n"
        else:
            report = f"### Modification Report\n\n"
            report += f"- Successfully applied: {len(applied)} improvements\n"
            report += f"- Failed: {len(failed)} improvements\n\n"
            
            if applied:
                report += "#### Applied Improvements:\n"
                for imp in applied:
                    report += f"- [{imp.priority.value.upper()}] {imp.description}\n"
            
            if failed:
                report += "\n#### Failed Improvements:\n"
                for imp, error in failed:
                    report += f"- {imp.description}: {str(error)}\n"
        
        return report
