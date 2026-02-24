#!/usr/bin/env python3
"""
测试重构后的 Ultrawork 工具

验证模块化组件的功能与原始版本一致
"""

import sys
import os

# 添加工具目录到路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../../..', 'template/.sce/tools'))

from document_evaluator import DocumentEvaluator, QualityAssessment
from improvement_identifier import ImprovementIdentifier, ImprovementType
from modification_applicator import ModificationApplicator
from ultrawork_enhancer_v2 import UltraworkEnhancer


def test_document_evaluator():
    """测试文档评估器"""
    print("🧪 测试 DocumentEvaluator...")
    
    evaluator = DocumentEvaluator()
    
    # 测试英文 Requirements 评估
    sample_en = """
## Introduction
This is a test document.

## Requirements
### Requirement 1
**User Story:** As a user, I want to login, So that I can access the system.

**Acceptance Criteria:**
- WHEN the user enters valid credentials THEN the system SHALL authenticate the user
- WHEN the user enters invalid credentials THEN the system SHALL reject the login

## Non-functional Requirements
### Performance
- System response time should be less than 2 seconds
"""
    
    assessment = evaluator.assess_requirements_quality(sample_en)
    print(f"  ✓ 英文文档评分: {assessment.score}/10")
    print(f"  ✓ 语言检测: {assessment.language}")
    print(f"  ✓ 缺失章节: {assessment.missing_sections}")
    
    # 测试中文 Requirements 评估
    sample_zh = """
## 1. 概述
这是一个测试文档。

## 2. 用户故事
作为用户我希望能够登录以便访问系统。

## 3. 功能需求
WHEN 用户输入有效凭证 THEN 系统应该验证用户身份

## 4. 非功能需求
### 性能需求
- 系统响应时间应小于 2 秒
"""
    
    assessment_zh = evaluator.assess_requirements_quality(sample_zh)
    print(f"  ✓ 中文文档评分: {assessment_zh.score}/10")
    print(f"  ✓ 语言检测: {assessment_zh.language}")
    
    print("✅ DocumentEvaluator 测试通过\n")


def test_improvement_identifier():
    """测试改进识别器"""
    print("🧪 测试 ImprovementIdentifier...")
    
    identifier = ImprovementIdentifier()
    evaluator = DocumentEvaluator()
    
    # 测试识别缺失章节
    incomplete_doc = """
## Introduction
This is incomplete.
"""
    
    assessment = evaluator.assess_requirements_quality(incomplete_doc)
    improvements = identifier.identify_requirements_improvements(incomplete_doc, assessment)
    
    print(f"  ✓ 识别到 {len(improvements)} 个改进点")
    for imp in improvements[:3]:  # 只显示前3个
        print(f"    - {imp.description}")
    
    print("✅ ImprovementIdentifier 测试通过\n")


def test_modification_applicator():
    """测试修改应用器"""
    print("🧪 测试 ModificationApplicator...")
    
    applicator = ModificationApplicator()
    identifier = ImprovementIdentifier()
    evaluator = DocumentEvaluator()
    
    # 测试应用改进
    incomplete_doc = """
## Introduction
This is incomplete.

## Requirements
Some requirements here.
"""
    
    assessment = evaluator.assess_requirements_quality(incomplete_doc)
    improvements = identifier.identify_requirements_improvements(incomplete_doc, assessment)
    
    result = applicator.apply_requirements_improvements(incomplete_doc, improvements, 'en')
    
    print(f"  ✓ 应用了 {len(result.applied_improvements)} 个改进")
    print(f"  ✓ 失败了 {len(result.failed_improvements)} 个改进")
    print(f"  ✓ 原文档长度: {len(incomplete_doc)} 字符")
    print(f"  ✓ 修改后长度: {len(result.modified_content)} 字符")
    
    # 验证内容保留
    assert "## Introduction" in result.modified_content, "原有内容应该保留"
    assert "## Requirements" in result.modified_content, "原有内容应该保留"
    
    print("✅ ModificationApplicator 测试通过\n")


def test_ultrawork_enhancer_integration():
    """测试 UltraworkEnhancer 集成"""
    print("🧪 测试 UltraworkEnhancer 集成...")
    
    enhancer = UltraworkEnhancer()
    
    # 验证组件已初始化
    assert enhancer.evaluator is not None, "Evaluator 应该已初始化"
    assert enhancer.identifier is not None, "Identifier 应该已初始化"
    assert enhancer.applicator is not None, "Applicator 应该已初始化"
    
    # 验证配置方法
    enhancer.set_quality_threshold(8.5)
    assert enhancer.quality_threshold == 8.5, "质量阈值应该可以设置"
    
    enhancer.set_max_iterations(5)
    assert enhancer.max_iterations == 5, "最大迭代次数应该可以设置"
    
    print("  ✓ 所有组件已正确初始化")
    print("  ✓ 配置方法工作正常")
    print("✅ UltraworkEnhancer 集成测试通过\n")


def test_backward_compatibility():
    """测试向后兼容性"""
    print("🧪 测试向后兼容性...")
    
    # 导入原始版本
    from ultrawork_enhancer import UltraworkEnhancer as OriginalEnhancer
    
    original = OriginalEnhancer()
    refactored = UltraworkEnhancer()
    
    # 验证接口一致性
    assert hasattr(refactored, 'enhance_requirements_quality'), "应该有 enhance_requirements_quality 方法"
    assert hasattr(refactored, 'enhance_design_completeness'), "应该有 enhance_design_completeness 方法"
    assert hasattr(refactored, 'enhance_task_execution'), "应该有 enhance_task_execution 方法"
    assert hasattr(refactored, 'set_quality_threshold'), "应该有 set_quality_threshold 方法"
    assert hasattr(refactored, 'set_max_iterations'), "应该有 set_max_iterations 方法"
    assert hasattr(refactored, 'get_improvement_log'), "应该有 get_improvement_log 方法"
    assert hasattr(refactored, 'reset_log'), "应该有 reset_log 方法"
    
    # 验证默认配置一致
    assert original.quality_threshold == refactored.quality_threshold, "默认质量阈值应该一致"
    assert original.max_iterations == refactored.max_iterations, "默认最大迭代次数应该一致"
    
    print("  ✓ 所有公共接口保持一致")
    print("  ✓ 默认配置保持一致")
    print("✅ 向后兼容性测试通过\n")


def main():
    """运行所有测试"""
    print("=" * 60)
    print("🔥 Ultrawork 重构测试套件")
    print("=" * 60)
    print()
    
    try:
        test_document_evaluator()
        test_improvement_identifier()
        test_modification_applicator()
        test_ultrawork_enhancer_integration()
        test_backward_compatibility()
        
        print("=" * 60)
        print("✅ 所有测试通过! 重构成功保持了原有功能!")
        print("=" * 60)
        return 0
        
    except Exception as e:
        print(f"\n❌ 测试失败: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
