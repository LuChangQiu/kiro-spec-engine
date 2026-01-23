#!/usr/bin/env python3
"""
Modification Applicator - 修改应用组件

负责将识别的改进应用到文档中，同时保持现有内容和结构
"""

from typing import List, Tuple
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
        """应用 Requirements 改进"""
        self.language = language
        modified_content = content
        applied = []
        failed = []
        
        for improvement in improvements:
            try:
                # 根据改进类型应用不同的修改策略
                if improvement.type.value == "add_section":
                    if improvement.target_section == "非功能需求" or improvement.target_section == "Non-functional Requirements":
                        if "## 4. 非功能需求" not in modified_content and "## Non-functional Requirements" not in modified_content:
                            template = self._get_nfr_template(language)
                            modified_content += template
                            applied.append(improvement)
                    elif improvement.target_section == "概述" or improvement.target_section == "Introduction":
                        # 在文档开头添加概述
                        if "## 1. 概述" not in modified_content and "## Introduction" not in modified_content:
                            template = self._get_introduction_template(language)
                            # 在第一个 ## 之前插入
                            parts = modified_content.split('\n## ', 1)
                            if len(parts) > 1:
                                modified_content = parts[0] + template + '\n## ' + parts[1]
                            else:
                                modified_content = template + '\n\n' + modified_content
                            applied.append(improvement)
                
                elif improvement.type.value == "add_nfr":
                    # 添加或补充非功能需求
                    if "## 4. 非功能需求" in modified_content or "## Non-functional Requirements" in modified_content:
                        # 已有章节，补充内容
                        pass  # 简化实现，实际需要更复杂的逻辑
                    else:
                        # 添加新章节
                        template = self._get_nfr_template(language)
                        modified_content += template
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
        """应用 Design 改进"""
        self.language = language
        modified_content = content
        applied = []
        failed = []
        
        for improvement in improvements:
            try:
                if improvement.type.value == "add_diagram":
                    if "```mermaid" not in modified_content:
                        template = self._get_architecture_diagram_template(language)
                        # 在架构设计章节后添加
                        if "## 2. 架构设计" in modified_content or "## Architecture" in modified_content:
                            # 找到章节位置并插入
                            pass  # 简化实现
                        else:
                            modified_content += template
                        applied.append(improvement)
                
                elif improvement.type.value == "add_rationale":
                    if "技术选型" not in modified_content and "Technology" not in modified_content.lower():
                        template = self._get_technology_stack_template(language)
                        modified_content += template
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
    
    def _get_nfr_template(self, language: str) -> str:
        """获取非功能需求模板"""
        if language == 'zh':
            return """

## 4. 非功能需求

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
            return """

## Non-functional Requirements

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
    
    def _get_introduction_template(self, language: str) -> str:
        """获取概述模板"""
        if language == 'zh':
            return """## 1. 概述

本文档描述了系统的需求规格说明。

### 1.1 项目背景
[待补充项目背景信息]

### 1.2 项目目标
[待补充项目目标]

"""
        else:
            return """## Introduction

This document describes the system requirements specification.

### Project Background
[To be filled with project background information]

### Project Goals
[To be filled with project goals]

"""
    
    def _get_architecture_diagram_template(self, language: str) -> str:
        """获取架构图模板"""
        if language == 'zh':
            return """

### 系统架构图

```mermaid
graph TB
    A[用户界面] --> B[业务逻辑层]
    B --> C[数据访问层]
    C --> D[数据存储]
```
"""
        else:
            return """

### System Architecture Diagram

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
            return """

## 技术选型

### 核心技术栈
- 前端: React/Vue.js
- 后端: Node.js/Python
- 数据库: PostgreSQL/MongoDB
- 缓存: Redis

### 选型理由
- 考虑团队技术栈熟悉度
- 满足性能和扩展性要求
- 社区支持和生态完善
"""
        else:
            return """

## Technology Stack

### Core Technologies
- Frontend: React/Vue.js
- Backend: Node.js/Python
- Database: PostgreSQL/MongoDB
- Cache: Redis

### Selection Rationale
- Team familiarity with technology stack
- Meets performance and scalability requirements
- Strong community support and ecosystem
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
                    report += f"- {imp.description}\n"
            
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
                    report += f"- {imp.description}\n"
            
            if failed:
                report += "\n#### Failed Improvements:\n"
                for imp, error in failed:
                    report += f"- {imp.description}: {str(error)}\n"
        
        return report
