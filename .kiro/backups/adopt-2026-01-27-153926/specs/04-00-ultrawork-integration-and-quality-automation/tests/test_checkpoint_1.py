#!/usr/bin/env python3
"""
Checkpoint 1 Test - Manual testing of core enhancement logic

Tests the three core components:
1. DocumentEvaluator - Quality assessment
2. ImprovementIdentifier - Improvement detection
3. ModificationApplicator - Document modification
"""

import sys
import os

# Add template tools to path
tools_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../../template/.kiro/tools'))
sys.path.insert(0, tools_path)

from document_evaluator import DocumentEvaluator, QualityAssessment
from improvement_identifier import ImprovementIdentifier
from modification_applicator import ModificationApplicator


def test_requirements_enhancement():
    """Test Requirements document enhancement flow"""
    print("\n" + "="*60)
    print("TEST 1: Requirements Document Enhancement")
    print("="*60)
    
    # Sample low-quality requirements document
    sample_requirements = """# Sample Requirements

## 1. Introduction
This is a test project.

## 2. Requirements
- User can login
- User can view data
"""
    
    # Step 1: Evaluate quality
    evaluator = DocumentEvaluator()
    assessment = evaluator.assess_requirements_quality(sample_requirements)
    
    print(f"\n✓ Initial Quality Score: {assessment.score:.2f}/10")
    print(f"  Language: {assessment.language}")
    print(f"  Missing Sections: {assessment.missing_sections}")
    print(f"  Issues: {assessment.issues[:3]}")  # Show first 3 issues
    
    # Step 2: Identify improvements
    identifier = ImprovementIdentifier()
    improvements = identifier.identify_requirements_improvements(sample_requirements, assessment)
    
    print(f"\n✓ Identified {len(improvements)} improvements")
    for i, imp in enumerate(improvements[:5], 1):  # Show first 5
        print(f"  {i}. [{imp.priority.value.upper()}] {imp.description}")
    
    # Step 3: Apply improvements
    applicator = ModificationApplicator()
    result = applicator.apply_requirements_improvements(
        sample_requirements, 
        improvements, 
        language=assessment.language
    )
    
    print(f"\n✓ Applied {len(result.applied_improvements)} improvements")
    print(f"  Failed: {len(result.failed_improvements)}")
    
    # Step 4: Re-evaluate quality
    new_assessment = evaluator.assess_requirements_quality(result.modified_content)
    
    print(f"\n✓ New Quality Score: {new_assessment.score:.2f}/10")
    print(f"  Improvement: +{new_assessment.score - assessment.score:.2f}")
    
    # Verify content preservation
    original_lines = [line for line in sample_requirements.split('\n') if line.strip()]
    modified_lines = result.modified_content.split('\n')
    
    preserved = all(line in result.modified_content for line in original_lines)
    print(f"\n✓ Content Preservation: {'PASS' if preserved else 'FAIL'}")
    
    return assessment.score < new_assessment.score


def test_design_enhancement():
    """Test Design document enhancement flow"""
    print("\n" + "="*60)
    print("TEST 2: Design Document Enhancement")
    print("="*60)
    
    # Sample low-quality design document
    sample_design = """# Sample Design

## 1. Overview
This is the design document.

## 2. Components
- Component A
- Component B
"""
    
    sample_requirements = """# Requirements
### 1.1 User Login
### 1.2 Data Display
"""
    
    # Step 1: Evaluate quality
    evaluator = DocumentEvaluator()
    assessment = evaluator.assess_design_quality(sample_design, sample_requirements)
    
    print(f"\n✓ Initial Quality Score: {assessment.score:.2f}/10")
    print(f"  Language: {assessment.language}")
    print(f"  Missing Sections: {assessment.missing_sections}")
    print(f"  Issues: {assessment.issues[:3]}")
    
    # Step 2: Identify improvements
    identifier = ImprovementIdentifier()
    improvements = identifier.identify_design_improvements(
        sample_design, 
        sample_requirements, 
        assessment
    )
    
    print(f"\n✓ Identified {len(improvements)} improvements")
    for i, imp in enumerate(improvements[:5], 1):
        print(f"  {i}. [{imp.priority.value.upper()}] {imp.description}")
    
    # Step 3: Apply improvements
    applicator = ModificationApplicator()
    result = applicator.apply_design_improvements(
        sample_design, 
        improvements, 
        sample_requirements,
        language=assessment.language
    )
    
    print(f"\n✓ Applied {len(result.applied_improvements)} improvements")
    print(f"  Failed: {len(result.failed_improvements)}")
    
    # Step 4: Re-evaluate quality
    new_assessment = evaluator.assess_design_quality(
        result.modified_content, 
        sample_requirements
    )
    
    print(f"\n✓ New Quality Score: {new_assessment.score:.2f}/10")
    print(f"  Improvement: +{new_assessment.score - assessment.score:.2f}")
    
    # Verify content preservation
    original_lines = [line for line in sample_design.split('\n') if line.strip()]
    preserved = all(line in result.modified_content for line in original_lines)
    print(f"\n✓ Content Preservation: {'PASS' if preserved else 'FAIL'}")
    
    return assessment.score < new_assessment.score


def test_bilingual_support():
    """Test bilingual (Chinese + English) support"""
    print("\n" + "="*60)
    print("TEST 3: Bilingual Support")
    print("="*60)
    
    # Chinese document
    chinese_doc = """# 需求文档

## 1. 概述
这是一个测试项目。

## 2. 功能需求
- 用户可以登录
- 用户可以查看数据
"""
    
    evaluator = DocumentEvaluator()
    assessment_zh = evaluator.assess_requirements_quality(chinese_doc)
    
    print(f"\n✓ Chinese Document Detected: {assessment_zh.language == 'zh'}")
    print(f"  Score: {assessment_zh.score:.2f}/10")
    
    # English document
    english_doc = """# Requirements Document

## 1. Introduction
This is a test project.

## 2. Requirements
- User can login
- User can view data
"""
    
    assessment_en = evaluator.assess_requirements_quality(english_doc)
    
    print(f"\n✓ English Document Detected: {assessment_en.language == 'en'}")
    print(f"  Score: {assessment_en.score:.2f}/10")
    
    return assessment_zh.language == 'zh' and assessment_en.language == 'en'


def main():
    """Run all checkpoint tests"""
    print("\n" + "="*60)
    print("CHECKPOINT 1: Core Enhancement Logic Testing")
    print("="*60)
    
    results = []
    
    try:
        results.append(("Requirements Enhancement", test_requirements_enhancement()))
    except Exception as e:
        print(f"\n✗ Requirements Enhancement FAILED: {e}")
        results.append(("Requirements Enhancement", False))
    
    try:
        results.append(("Design Enhancement", test_design_enhancement()))
    except Exception as e:
        print(f"\n✗ Design Enhancement FAILED: {e}")
        results.append(("Design Enhancement", False))
    
    try:
        results.append(("Bilingual Support", test_bilingual_support()))
    except Exception as e:
        print(f"\n✗ Bilingual Support FAILED: {e}")
        results.append(("Bilingual Support", False))
    
    # Summary
    print("\n" + "="*60)
    print("CHECKPOINT 1 SUMMARY")
    print("="*60)
    
    for test_name, passed in results:
        status = "✓ PASS" if passed else "✗ FAIL"
        print(f"{status}: {test_name}")
    
    all_passed = all(result[1] for result in results)
    
    print("\n" + "="*60)
    if all_passed:
        print("✓ CHECKPOINT 1 PASSED - Core enhancement logic works!")
    else:
        print("✗ CHECKPOINT 1 FAILED - Some tests failed")
    print("="*60 + "\n")
    
    return 0 if all_passed else 1


if __name__ == '__main__':
    sys.exit(main())
