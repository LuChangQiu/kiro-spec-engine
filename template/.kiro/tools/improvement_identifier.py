#!/usr/bin/env python3
"""
Improvement Identifier - 改进识别组件

负责分析质量评估结果，识别具体的改进点
"""

import re
from typing import List, Optional
from dataclasses import dataclass
from enum import Enum


class ImprovementType(Enum):
    """改进类型"""
    ADD_SECTION = "add_section"
    ENHANCE_CRITERIA = "enhance_criteria"
    ADD_NFR = "add_nfr"
    ADD_ERROR_HANDLING = "add_error_handling"
    ADD_EDGE_CASES = "add_edge_cases"
    ADD_GLOSSARY_TERM = "add_glossary_term"
    ADD_COMPONENT_DETAIL = "add_component_detail"
    ADD_TRACEABILITY = "add_traceability"
    ADD_PROPERTIES = "add_properties"
    ADD_RATIONALE = "add_rationale"
    ADD_DIAGRAM = "add_diagram"


class Priority(Enum):
    """优先级"""
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


@dataclass
class Improvement:
    """改进项"""
    type: ImprovementType
    target_section: str
    description: str
    priority: Priority
    template: Optional[str] = None
    metadata: dict = None
    
    def __post_init__(self):
        if self.metadata is None:
            self.metadata = {}


class ImprovementIdentifier:
    """
    改进识别器 - 识别文档改进点
    
    支持中英文文档
    """
    
    def __init__(self):
        self.language = 'en'

    def identify_requirements_improvements(self, content: str, assessment) -> List[Improvement]:
        """识别 Requirements 文档的改进点 - 支持中英文"""
        improvements = []
        lang = assessment.language
        self.language = lang
        
        if lang == 'zh':
            # 中文改进建议
            if "## 1. 概述" not in content and "## Introduction" not in content:
                improvements.append(Improvement(
                    type=ImprovementType.ADD_SECTION,
                    target_section="概述",
                    description="添加项目概述章节",
                    priority=Priority.HIGH
                ))
            
            if "## 2. 用户故事" not in content:
                improvements.append(Improvement(
                    type=ImprovementType.ADD_SECTION,
                    target_section="用户故事",
                    description="添加用户故事章节",
                    priority=Priority.HIGH
                ))
            
            if "## 4. 非功能需求" not in content:
                improvements.append(Improvement(
                    type=ImprovementType.ADD_NFR,
                    target_section="非功能需求",
                    description="添加非功能需求章节",
                    priority=Priority.MEDIUM
                ))
            
            # 检查 EARS 格式
            ears_count = len(re.findall(r'WHEN.*THEN', content, re.IGNORECASE))
            if ears_count < 5:
                improvements.append(Improvement(
                    type=ImprovementType.ENHANCE_CRITERIA,
                    target_section="验收标准",
                    description=f"增加更多 EARS 格式的验收标准 (当前 {ears_count}，目标 5+)",
                    priority=Priority.HIGH,
                    metadata={'current_count': ears_count, 'target_count': 5}
                ))
            
            # 检查用户故事格式
            user_story_count = len(re.findall(r'作为.*我希望.*以便', content))
            if user_story_count < 3:
                improvements.append(Improvement(
                    type=ImprovementType.ENHANCE_CRITERIA,
                    target_section="用户故事",
                    description=f"完善用户故事格式 (当前 {user_story_count}，目标 3+)",
                    priority=Priority.HIGH,
                    metadata={'current_count': user_story_count, 'target_count': 3}
                ))
            
            # 检查非功能需求覆盖
            nfr_keywords = ['性能需求', '安全需求', '可用性需求', '可维护性需求']
            missing_nfr = [kw for kw in nfr_keywords if kw not in content]
            
            if missing_nfr and "## 4. 非功能需求" in content:
                improvements.append(Improvement(
                    type=ImprovementType.ADD_NFR,
                    target_section="非功能需求",
                    description=f"补充非功能需求: {', '.join([k.replace('需求', '') for k in missing_nfr])}",
                    priority=Priority.MEDIUM,
                    metadata={'missing_nfr': missing_nfr}
                ))
        else:
            # 英文改进建议
            if "## Introduction" not in content and "## Overview" not in content:
                improvements.append(Improvement(
                    type=ImprovementType.ADD_SECTION,
                    target_section="Introduction",
                    description="Add Introduction or Overview section",
                    priority=Priority.HIGH
                ))
            
            if "## Glossary" not in content and "## Terminology" not in content:
                improvements.append(Improvement(
                    type=ImprovementType.ADD_GLOSSARY_TERM,
                    target_section="Glossary",
                    description="Add Glossary section to define key terms",
                    priority=Priority.MEDIUM
                ))
            
            if "User Story" not in content and "user story" not in content:
                improvements.append(Improvement(
                    type=ImprovementType.ADD_SECTION,
                    target_section="User Stories",
                    description="Add User Stories section",
                    priority=Priority.HIGH
                ))
            
            # 检查 EARS 格式
            ears_count = len(re.findall(r'WHEN.*THEN|IF.*THEN', content, re.IGNORECASE))
            if ears_count < 5:
                improvements.append(Improvement(
                    type=ImprovementType.ENHANCE_CRITERIA,
                    target_section="Acceptance Criteria",
                    description=f"Add more EARS-format acceptance criteria (currently {ears_count}, target 5+)",
                    priority=Priority.HIGH,
                    metadata={'current_count': ears_count, 'target_count': 5}
                ))
            
            # 检查用户故事格式
            user_story_count = len(re.findall(r'As a.*I want.*So that', content, re.IGNORECASE))
            if user_story_count < 3:
                improvements.append(Improvement(
                    type=ImprovementType.ENHANCE_CRITERIA,
                    target_section="User Stories",
                    description=f"Add more user stories in 'As a...I want...So that' format (currently {user_story_count}, target 3+)",
                    priority=Priority.HIGH,
                    metadata={'current_count': user_story_count, 'target_count': 3}
                ))
            
            # 检查非功能需求
            nfr_keywords = ['performance', 'security', 'usability', 'maintainability', 'scalability']
            missing_nfr = [kw for kw in nfr_keywords if kw.lower() not in content.lower()]
            
            if missing_nfr and len(missing_nfr) > 2:
                improvements.append(Improvement(
                    type=ImprovementType.ADD_NFR,
                    target_section="Non-functional Requirements",
                    description=f"Add non-functional requirements: {', '.join(missing_nfr[:3])}",
                    priority=Priority.MEDIUM,
                    metadata={'missing_nfr': missing_nfr[:3]}
                ))
        
        return improvements
    
    def identify_design_improvements(self, design_content: str, requirements_content: str, assessment) -> List[Improvement]:
        """识别 Design 文档的改进点"""
        improvements = []
        lang = assessment.language
        self.language = lang
        
        # 检查基础结构
        if "## 1. 系统概述" not in design_content and "## 1. 概述" not in design_content and "## Overview" not in design_content:
            improvements.append(Improvement(
                type=ImprovementType.ADD_SECTION,
                target_section="系统概述" if lang == 'zh' else "Overview",
                description="添加系统概述章节" if lang == 'zh' else "Add system overview section",
                priority=Priority.HIGH
            ))
        
        if "## 2. 架构设计" not in design_content and "## Architecture" not in design_content:
            improvements.append(Improvement(
                type=ImprovementType.ADD_SECTION,
                target_section="架构设计" if lang == 'zh' else "Architecture",
                description="添加架构设计章节" if lang == 'zh' else "Add architecture design section",
                priority=Priority.HIGH
            ))
        
        if "## 3. 组件设计" not in design_content and "## Components" not in design_content:
            improvements.append(Improvement(
                type=ImprovementType.ADD_COMPONENT_DETAIL,
                target_section="组件设计" if lang == 'zh' else "Components",
                description="添加组件设计章节" if lang == 'zh' else "Add components design section",
                priority=Priority.HIGH
            ))
        
        # 检查需求追溯
        req_references = len(re.findall(r'需求\s*\d+\.\d+|Requirements?\s*\d+\.\d+|Validates:\s+Requirements?\s+\d+\.\d+', design_content, re.IGNORECASE))
        if req_references < 3:
            improvements.append(Improvement(
                type=ImprovementType.ADD_TRACEABILITY,
                target_section="全文",
                description=f"增加需求到设计的双向追溯 (当前 {req_references}，目标 3+)" if lang == 'zh' else f"Add requirements traceability (current {req_references}, target 3+)",
                priority=Priority.HIGH,
                metadata={'current_count': req_references, 'target_count': 3}
            ))
        
        # 检查架构图
        if "```mermaid" not in design_content and "架构图" not in design_content:
            improvements.append(Improvement(
                type=ImprovementType.ADD_DIAGRAM,
                target_section="架构设计" if lang == 'zh' else "Architecture",
                description="添加架构图或设计图" if lang == 'zh' else "Add architecture or design diagrams",
                priority=Priority.MEDIUM
            ))
        
        # 检查技术选型
        tech_keywords = ['技术选型', '技术栈', '框架选择'] if lang == 'zh' else ['technology', 'framework', 'stack']
        if not any(keyword in design_content.lower() for keyword in [k.lower() for k in tech_keywords]):
            improvements.append(Improvement(
                type=ImprovementType.ADD_RATIONALE,
                target_section="技术选型" if lang == 'zh' else "Technology Stack",
                description="补充技术选型说明" if lang == 'zh' else "Add technology stack explanation",
                priority=Priority.MEDIUM
            ))
        
        # 检查非功能需求设计
        nfr_design = ['性能设计', '安全设计', '可扩展性'] if lang == 'zh' else ['performance', 'security', 'scalability']
        missing_nfr = [nfr for nfr in nfr_design if nfr.lower() not in design_content.lower()]
        if missing_nfr:
            improvements.append(Improvement(
                type=ImprovementType.ADD_COMPONENT_DETAIL,
                target_section="非功能需求设计" if lang == 'zh' else "Non-functional Design",
                description=f"补充非功能需求设计: {', '.join(missing_nfr)}" if lang == 'zh' else f"Add non-functional design: {', '.join(missing_nfr)}",
                priority=Priority.MEDIUM,
                metadata={'missing_nfr': missing_nfr}
            ))
        
        return improvements
