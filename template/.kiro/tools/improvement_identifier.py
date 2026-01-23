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
        """识别 Requirements 文档的改进点 - 支持中英文，增强改进识别"""
        improvements = []
        lang = assessment.language
        self.language = lang
        
        if lang == 'zh':
            # 中文改进建议 - 增强版
            # 检查基础结构
            if "## 1. 概述" not in content and "## Introduction" not in content and "## 概述" not in content:
                improvements.append(Improvement(
                    type=ImprovementType.ADD_SECTION,
                    target_section="概述",
                    description="添加项目概述章节，包括项目背景和目标",
                    priority=Priority.HIGH,
                    template="introduction_zh"
                ))
            
            if "## 2. 用户故事" not in content and "用户故事" not in content:
                improvements.append(Improvement(
                    type=ImprovementType.ADD_SECTION,
                    target_section="用户故事",
                    description="添加用户故事章节，描述用户需求",
                    priority=Priority.HIGH,
                    template="user_stories_zh"
                ))
            
            if "## 3. 功能需求" not in content and "功能需求" not in content:
                improvements.append(Improvement(
                    type=ImprovementType.ADD_SECTION,
                    target_section="功能需求",
                    description="添加功能需求章节",
                    priority=Priority.HIGH,
                    template="functional_requirements_zh"
                ))
            
            if "## 4. 非功能需求" not in content and "非功能需求" not in content:
                improvements.append(Improvement(
                    type=ImprovementType.ADD_NFR,
                    target_section="非功能需求",
                    description="添加非功能需求章节，包括性能、安全等",
                    priority=Priority.MEDIUM,
                    template="nfr_section_zh"
                ))
            
            # 检查 EARS 格式
            ears_count = len(re.findall(r'(?:WHEN|当|如果).*?(?:THEN|那么|则).*?(?:SHALL|应该|必须)', content, re.IGNORECASE | re.DOTALL))
            if ears_count < 5:
                improvements.append(Improvement(
                    type=ImprovementType.ENHANCE_CRITERIA,
                    target_section="验收标准",
                    description=f"增加更多 EARS 格式的验收标准 (当前 {ears_count}，目标 5+)",
                    priority=Priority.HIGH,
                    template="ears_criteria_zh",
                    metadata={'current_count': ears_count, 'target_count': 5}
                ))
            
            # 检查用户故事格式
            user_story_count = len(re.findall(r'(?:作为|As a).*?(?:我希望|I want).*?(?:以便|So that)', content, re.IGNORECASE | re.DOTALL))
            if user_story_count < 3:
                improvements.append(Improvement(
                    type=ImprovementType.ENHANCE_CRITERIA,
                    target_section="用户故事",
                    description=f"完善用户故事格式 (当前 {user_story_count}，目标 3+)",
                    priority=Priority.HIGH,
                    template="user_story_format_zh",
                    metadata={'current_count': user_story_count, 'target_count': 3}
                ))
            
            # 检查验收标准完整性
            acceptance_criteria = len(re.findall(r'(?:\*\*验收标准\*\*:|Acceptance Criteria)', content, re.IGNORECASE))
            requirements_count = len(re.findall(r'### \d+\.\d+', content))
            if requirements_count > 0 and acceptance_criteria < requirements_count:
                improvements.append(Improvement(
                    type=ImprovementType.ENHANCE_CRITERIA,
                    target_section="验收标准",
                    description=f"为所有需求添加验收标准 ({acceptance_criteria}/{requirements_count})",
                    priority=Priority.HIGH,
                    metadata={'current': acceptance_criteria, 'total': requirements_count}
                ))
            
            # 检查非功能需求覆盖
            nfr_keywords = ['性能', '安全', '可用性', '可维护性', '兼容性', '可扩展性']
            missing_nfr = [kw for kw in nfr_keywords if kw not in content]
            
            if missing_nfr and ("## 4. 非功能需求" in content or "非功能需求" in content):
                improvements.append(Improvement(
                    type=ImprovementType.ADD_NFR,
                    target_section="非功能需求",
                    description=f"补充非功能需求: {', '.join(missing_nfr[:3])}",
                    priority=Priority.MEDIUM,
                    template="nfr_items_zh",
                    metadata={'missing_nfr': missing_nfr}
                ))
            
            # 检查错误处理需求
            if "错误处理" not in content and "异常处理" not in content:
                improvements.append(Improvement(
                    type=ImprovementType.ADD_ERROR_HANDLING,
                    target_section="功能需求",
                    description="添加错误处理和异常情况需求",
                    priority=Priority.MEDIUM,
                    template="error_handling_zh"
                ))
            
            # 检查边界条件
            edge_case_keywords = ['边界', '极限', '最大', '最小', '空值', '异常']
            edge_case_count = sum(1 for kw in edge_case_keywords if kw in content)
            if edge_case_count < 2:
                improvements.append(Improvement(
                    type=ImprovementType.ADD_EDGE_CASES,
                    target_section="验收标准",
                    description="添加边界条件和极限情况的验收标准",
                    priority=Priority.MEDIUM,
                    template="edge_cases_zh"
                ))
            
            # 检查约束条件
            if "约束条件" not in content and "限制" not in content:
                improvements.append(Improvement(
                    type=ImprovementType.ADD_SECTION,
                    target_section="约束条件",
                    description="添加约束条件和限制说明",
                    priority=Priority.LOW,
                    template="constraints_zh"
                ))
        else:
            # 英文改进建议 - 增强版
            # 检查基础结构
            if "## Introduction" not in content and "## Overview" not in content:
                improvements.append(Improvement(
                    type=ImprovementType.ADD_SECTION,
                    target_section="Introduction",
                    description="Add Introduction or Overview section with project background and goals",
                    priority=Priority.HIGH,
                    template="introduction_en"
                ))
            
            if "## Glossary" not in content and "## Terminology" not in content:
                improvements.append(Improvement(
                    type=ImprovementType.ADD_GLOSSARY_TERM,
                    target_section="Glossary",
                    description="Add Glossary section to define key terms",
                    priority=Priority.MEDIUM,
                    template="glossary_en"
                ))
            
            if "User Story" not in content and "user story" not in content.lower():
                improvements.append(Improvement(
                    type=ImprovementType.ADD_SECTION,
                    target_section="User Stories",
                    description="Add User Stories section",
                    priority=Priority.HIGH,
                    template="user_stories_en"
                ))
            
            if "## Requirements" not in content and "## Functional Requirements" not in content:
                improvements.append(Improvement(
                    type=ImprovementType.ADD_SECTION,
                    target_section="Requirements",
                    description="Add Requirements or Functional Requirements section",
                    priority=Priority.HIGH,
                    template="functional_requirements_en"
                ))
            
            # 检查 EARS 格式
            ears_count = len(re.findall(r'(?:WHEN|IF|WHILE|WHERE).*?(?:THEN|THE\s+system\s+SHALL)', content, re.IGNORECASE | re.DOTALL))
            if ears_count < 5:
                improvements.append(Improvement(
                    type=ImprovementType.ENHANCE_CRITERIA,
                    target_section="Acceptance Criteria",
                    description=f"Add more EARS-format acceptance criteria (currently {ears_count}, target 5+)",
                    priority=Priority.HIGH,
                    template="ears_criteria_en",
                    metadata={'current_count': ears_count, 'target_count': 5}
                ))
            
            # 检查用户故事格式
            user_story_count = len(re.findall(r'(?:As a|As an).*?I want.*?(?:So that|so that)', content, re.IGNORECASE | re.DOTALL))
            if user_story_count < 3:
                improvements.append(Improvement(
                    type=ImprovementType.ENHANCE_CRITERIA,
                    target_section="User Stories",
                    description=f"Add more user stories in 'As a...I want...So that' format (currently {user_story_count}, target 3+)",
                    priority=Priority.HIGH,
                    template="user_story_format_en",
                    metadata={'current_count': user_story_count, 'target_count': 3}
                ))
            
            # 检查验收标准完整性
            acceptance_criteria = len(re.findall(r'(?:Acceptance Criteria|#### Acceptance Criteria)', content, re.IGNORECASE))
            requirements_count = len(re.findall(r'### Requirement \d+', content, re.IGNORECASE))
            if requirements_count > 0 and acceptance_criteria < requirements_count:
                improvements.append(Improvement(
                    type=ImprovementType.ENHANCE_CRITERIA,
                    target_section="Acceptance Criteria",
                    description=f"Add acceptance criteria for all requirements ({acceptance_criteria}/{requirements_count})",
                    priority=Priority.HIGH,
                    metadata={'current': acceptance_criteria, 'total': requirements_count}
                ))
            
            # 检查非功能需求
            nfr_keywords = ['performance', 'security', 'usability', 'maintainability', 'scalability', 'reliability']
            missing_nfr = [kw for kw in nfr_keywords if kw.lower() not in content.lower()]
            
            if len(missing_nfr) > 2:
                improvements.append(Improvement(
                    type=ImprovementType.ADD_NFR,
                    target_section="Non-functional Requirements",
                    description=f"Add non-functional requirements: {', '.join(missing_nfr[:3])}",
                    priority=Priority.MEDIUM,
                    template="nfr_section_en",
                    metadata={'missing_nfr': missing_nfr[:3]}
                ))
            
            # 检查错误处理需求
            if "error handling" not in content.lower() and "exception" not in content.lower():
                improvements.append(Improvement(
                    type=ImprovementType.ADD_ERROR_HANDLING,
                    target_section="Requirements",
                    description="Add error handling and exception requirements",
                    priority=Priority.MEDIUM,
                    template="error_handling_en"
                ))
            
            # 检查边界条件
            edge_case_keywords = ['boundary', 'edge case', 'limit', 'maximum', 'minimum', 'empty', 'null']
            edge_case_count = sum(1 for kw in edge_case_keywords if kw.lower() in content.lower())
            if edge_case_count < 2:
                improvements.append(Improvement(
                    type=ImprovementType.ADD_EDGE_CASES,
                    target_section="Acceptance Criteria",
                    description="Add boundary conditions and edge cases to acceptance criteria",
                    priority=Priority.MEDIUM,
                    template="edge_cases_en"
                ))
            
            # 检查约束条件
            if "constraint" not in content.lower() and "limitation" not in content.lower():
                improvements.append(Improvement(
                    type=ImprovementType.ADD_SECTION,
                    target_section="Constraints",
                    description="Add constraints and limitations section",
                    priority=Priority.LOW,
                    template="constraints_en"
                ))
        
        return improvements
    
    def identify_design_improvements(self, design_content: str, requirements_content: str, assessment) -> List[Improvement]:
        """识别 Design 文档的改进点 - 增强版"""
        improvements = []
        lang = assessment.language
        self.language = lang
        
        # 检查基础结构
        if "## 1. 系统概述" not in design_content and "## 1. 概述" not in design_content and "## Overview" not in design_content:
            improvements.append(Improvement(
                type=ImprovementType.ADD_SECTION,
                target_section="系统概述" if lang == 'zh' else "Overview",
                description="添加系统概述章节，包括设计目标和方法" if lang == 'zh' else "Add system overview section with design goals and approach",
                priority=Priority.HIGH,
                template="overview_zh" if lang == 'zh' else "overview_en"
            ))
        
        if "## 2. 架构设计" not in design_content and "## Architecture" not in design_content:
            improvements.append(Improvement(
                type=ImprovementType.ADD_SECTION,
                target_section="架构设计" if lang == 'zh' else "Architecture",
                description="添加架构设计章节，包括系统架构图" if lang == 'zh' else "Add architecture design section with system architecture diagram",
                priority=Priority.HIGH,
                template="architecture_zh" if lang == 'zh' else "architecture_en"
            ))
        
        if "## 3. 组件设计" not in design_content and "## Components" not in design_content:
            improvements.append(Improvement(
                type=ImprovementType.ADD_COMPONENT_DETAIL,
                target_section="组件设计" if lang == 'zh' else "Components",
                description="添加组件设计章节，详细描述各组件" if lang == 'zh' else "Add components design section with detailed component descriptions",
                priority=Priority.HIGH,
                template="components_zh" if lang == 'zh' else "components_en"
            ))
        
        # 检查需求追溯
        req_references = len(re.findall(r'(?:需求|Requirements?|Validates:)\s*\d+\.\d+', design_content, re.IGNORECASE))
        bidirectional_refs = len(re.findall(r'Validates:\s*Requirements?\s+\d+\.\d+', design_content, re.IGNORECASE))
        
        if req_references < 3:
            improvements.append(Improvement(
                type=ImprovementType.ADD_TRACEABILITY,
                target_section="全文" if lang == 'zh' else "全文",
                description=f"增加需求到设计的双向追溯 (当前 {req_references}，目标 5+)" if lang == 'zh' else f"Add requirements traceability (current {req_references}, target 5+)",
                priority=Priority.HIGH,
                template="traceability_zh" if lang == 'zh' else "traceability_en",
                metadata={'current_count': req_references, 'target_count': 5}
            ))
        
        if bidirectional_refs == 0:
            improvements.append(Improvement(
                type=ImprovementType.ADD_TRACEABILITY,
                target_section="组件设计" if lang == 'zh' else "Components",
                description="为设计元素添加 'Validates: Requirements X.Y' 注释" if lang == 'zh' else "Add 'Validates: Requirements X.Y' annotations to design elements",
                priority=Priority.HIGH,
                template="validates_annotation"
            ))
        
        # 检查架构图
        mermaid_count = len(re.findall(r'```mermaid', design_content))
        if mermaid_count == 0:
            improvements.append(Improvement(
                type=ImprovementType.ADD_DIAGRAM,
                target_section="架构设计" if lang == 'zh' else "Architecture",
                description="添加 Mermaid 架构图或设计图" if lang == 'zh' else "Add Mermaid architecture or design diagrams",
                priority=Priority.MEDIUM,
                template="mermaid_diagram_zh" if lang == 'zh' else "mermaid_diagram_en"
            ))
        
        # 检查组件详细度
        component_sections = len(re.findall(r'### \d+\.\d+', design_content))
        if component_sections < 3:
            improvements.append(Improvement(
                type=ImprovementType.ADD_COMPONENT_DETAIL,
                target_section="组件设计" if lang == 'zh' else "Components",
                description=f"增加更多组件描述 (当前 {component_sections}，建议 3+)" if lang == 'zh' else f"Add more component descriptions (current {component_sections}, suggest 3+)",
                priority=Priority.MEDIUM,
                metadata={'current_count': component_sections}
            ))
        
        # 检查接口定义
        interface_count = len(re.findall(r'(?:接口定义|Interface|API)', design_content, re.IGNORECASE))
        if interface_count < 2:
            improvements.append(Improvement(
                type=ImprovementType.ADD_COMPONENT_DETAIL,
                target_section="组件设计" if lang == 'zh' else "Components",
                description="为组件添加接口定义和方法签名" if lang == 'zh' else "Add interface definitions and method signatures to components",
                priority=Priority.MEDIUM,
                template="interface_definition"
            ))
        
        # 检查技术选型
        tech_keywords = ['技术选型', '技术栈', '框架选择'] if lang == 'zh' else ['technology', 'framework', 'stack']
        if not any(keyword.lower() in design_content.lower() for keyword in tech_keywords):
            improvements.append(Improvement(
                type=ImprovementType.ADD_RATIONALE,
                target_section="技术选型" if lang == 'zh' else "Technology Stack",
                description="补充技术选型说明和选型理由" if lang == 'zh' else "Add technology stack explanation and rationale",
                priority=Priority.MEDIUM,
                template="technology_stack_zh" if lang == 'zh' else "technology_stack_en"
            ))
        
        # 检查错误处理策略
        if "错误处理" not in design_content and "Error Handling" not in design_content:
            improvements.append(Improvement(
                type=ImprovementType.ADD_SECTION,
                target_section="错误处理" if lang == 'zh' else "Error Handling",
                description="添加错误处理策略章节" if lang == 'zh' else "Add error handling strategy section",
                priority=Priority.MEDIUM,
                template="error_handling_design_zh" if lang == 'zh' else "error_handling_design_en"
            ))
        
        # 检查非功能需求设计
        nfr_design = ['性能设计', '安全设计', '可扩展性'] if lang == 'zh' else ['performance', 'security', 'scalability']
        missing_nfr = [nfr for nfr in nfr_design if nfr.lower() not in design_content.lower()]
        if len(missing_nfr) >= 2:
            improvements.append(Improvement(
                type=ImprovementType.ADD_COMPONENT_DETAIL,
                target_section="非功能需求设计" if lang == 'zh' else "Non-functional Design",
                description=f"补充非功能需求设计: {', '.join(missing_nfr)}" if lang == 'zh' else f"Add non-functional design: {', '.join(missing_nfr)}",
                priority=Priority.MEDIUM,
                template="nfr_design_zh" if lang == 'zh' else "nfr_design_en",
                metadata={'missing_nfr': missing_nfr}
            ))
        
        # 检查正确性属性
        if "Correctness Properties" not in design_content and "正确性属性" not in design_content:
            improvements.append(Improvement(
                type=ImprovementType.ADD_PROPERTIES,
                target_section="正确性属性" if lang == 'zh' else "Correctness Properties",
                description="添加正确性属性章节，用于属性测试" if lang == 'zh' else "Add correctness properties section for property-based testing",
                priority=Priority.LOW,
                template="correctness_properties_zh" if lang == 'zh' else "correctness_properties_en"
            ))
        
        return improvements
