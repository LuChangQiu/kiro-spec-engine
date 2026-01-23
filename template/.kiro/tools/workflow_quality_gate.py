#!/usr/bin/env python3
"""
Workflow Quality Gate - Spec 创建工作流集成脚本

用于在 requirements-first-workflow subagent 中调用质量门控
"""

import sys
import os
from pathlib import Path
from quality_gate_enforcer import QualityGateEnforcer, GateResult


def main():
    """
    命令行入口 - 供 subagent 调用
    
    Usage:
        python workflow_quality_gate.py requirements <path>
        python workflow_quality_gate.py design <design_path> <requirements_path>
        python workflow_quality_gate.py tasks <path>
    
    Exit Codes:
        0 - Quality gate passed
        1 - Quality gate failed
        2 - Error occurred
    """
    if len(sys.argv) < 3:
        print("Error: Insufficient arguments", file=sys.stderr)
        print("Usage: workflow_quality_gate.py <stage> <path> [requirements_path]", file=sys.stderr)
        sys.exit(2)
    
    stage = sys.argv[1].lower()
    doc_path = sys.argv[2]
    
    # 验证文件存在
    if not os.path.exists(doc_path):
        print(f"Error: File not found: {doc_path}", file=sys.stderr)
        sys.exit(2)
    
    try:
        # 创建质量门控器
        enforcer = QualityGateEnforcer(
            requirements_threshold=9.0,
            design_threshold=9.0,
            tasks_threshold=8.0
        )
        
        # 执行质量门检查
        if stage == 'requirements':
            result = enforcer.check_requirements_gate(doc_path)
        
        elif stage == 'design':
            if len(sys.argv) < 4:
                print("Error: Design gate requires requirements path", file=sys.stderr)
                sys.exit(2)
            requirements_path = sys.argv[3]
            if not os.path.exists(requirements_path):
                print(f"Error: Requirements file not found: {requirements_path}", file=sys.stderr)
                sys.exit(2)
            result = enforcer.check_design_gate(doc_path, requirements_path)
        
        elif stage == 'tasks':
            result = enforcer.check_tasks_gate(doc_path)
        
        else:
            print(f"Error: Unknown stage '{stage}'", file=sys.stderr)
            print("Valid stages: requirements, design, tasks", file=sys.stderr)
            sys.exit(2)
        
        # 输出结果
        print(f"\n{'='*60}")
        print(f"Quality Gate Result: {stage.upper()}")
        print(f"{'='*60}")
        print(f"Status: {'PASSED ✓' if result.passed else 'FAILED ✗'}")
        print(f"Score: {result.score:.2f}/10")
        print(f"Threshold: {result.threshold}/10")
        
        if result.enhancement_result:
            print(f"\nEnhancement Details:")
            print(f"  Initial Score: {result.enhancement_result.initial_score:.2f}/10")
            print(f"  Final Score: {result.enhancement_result.final_score:.2f}/10")
            print(f"  Improvement: +{result.enhancement_result.improvement:.2f}")
            print(f"  Iterations: {result.enhancement_result.iterations}")
            print(f"  Stopping Reason: {result.enhancement_result.stopping_reason}")
        
        print(f"{'='*60}\n")
        
        # 返回退出码
        sys.exit(0 if result.passed else 1)
    
    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        sys.exit(2)


if __name__ == '__main__':
    main()
