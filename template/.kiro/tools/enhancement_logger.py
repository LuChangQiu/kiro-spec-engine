#!/usr/bin/env python3
"""
Enhancement Logger - 增强日志记录器

提供详细的增强过程日志记录
注意：这是一个轻量级实现，基本日志功能已集成在 ErrorHandler 中
"""

import sys
from datetime import datetime
from pathlib import Path
from typing import Optional


class EnhancementLogger:
    """
    增强日志记录器
    
    提供增强过程的详细日志记录，支持控制台和文件输出
    """
    
    def __init__(self, log_file: Optional[str] = None, verbose: bool = False):
        """
        初始化日志记录器
        
        Args:
            log_file: 日志文件路径（可选）
            verbose: 是否启用详细模式
        """
        self.log_file = log_file
        self.verbose = verbose
        self.log_handle = None
        
        if log_file:
            Path(log_file).parent.mkdir(parents=True, exist_ok=True)
            self.log_handle = open(log_file, 'a', encoding='utf-8')
    
    def __del__(self):
        """清理资源"""
        if self.log_handle:
            self.log_handle.close()
    
    def _write(self, message: str, to_console: bool = True):
        """
        写入日志
        
        Args:
            message: 日志消息
            to_console: 是否输出到控制台
        """
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        formatted = f"[{timestamp}] {message}"
        
        if to_console:
            print(formatted)
        
        if self.log_handle:
            self.log_handle.write(formatted + '\n')
            self.log_handle.flush()
    
    def log_cycle_start(self, document_type: str, document_path: str):
        """
        记录增强周期开始
        
        Args:
            document_type: 文档类型 (requirements/design/tasks)
            document_path: 文档路径
        """
        self._write(f"\n{'='*60}")
        self._write(f"Enhancement Cycle Started: {document_type.upper()}")
        self._write(f"Document: {document_path}")
        self._write(f"{'='*60}\n")
    
    def log_cycle_stop(self, document_type: str, initial_score: float, 
                       final_score: float, iterations: int, reason: str):
        """
        记录增强周期结束
        
        Args:
            document_type: 文档类型
            initial_score: 初始分数
            final_score: 最终分数
            iterations: 迭代次数
            reason: 停止原因
        """
        improvement = final_score - initial_score
        self._write(f"\n{'='*60}")
        self._write(f"Enhancement Cycle Completed: {document_type.upper()}")
        self._write(f"Initial Score: {initial_score:.2f}/10")
        self._write(f"Final Score: {final_score:.2f}/10")
        self._write(f"Improvement: +{improvement:.2f}")
        self._write(f"Iterations: {iterations}")
        self._write(f"Stopping Reason: {reason}")
        self._write(f"{'='*60}\n")
    
    def log_iteration_start(self, iteration: int, current_score: float):
        """
        记录迭代开始
        
        Args:
            iteration: 迭代编号
            current_score: 当前分数
        """
        self._write(f"\n--- Iteration {iteration} ---")
        self._write(f"Current Score: {current_score:.2f}/10")
    
    def log_iteration_complete(self, iteration: int, new_score: float, 
                               improvements_applied: int):
        """
        记录迭代完成
        
        Args:
            iteration: 迭代编号
            new_score: 新分数
            improvements_applied: 应用的改进数量
        """
        self._write(f"Iteration {iteration} Complete:")
        self._write(f"  New Score: {new_score:.2f}/10")
        self._write(f"  Improvements Applied: {improvements_applied}")
    
    def log_improvement_application(self, improvement_type: str, 
                                   section: str, success: bool):
        """
        记录改进应用
        
        Args:
            improvement_type: 改进类型
            section: 目标章节
            success: 是否成功
        """
        status = "✓" if success else "✗"
        message = f"  {status} Applied: {improvement_type} → {section}"
        
        if self.verbose or not success:
            self._write(message)
    
    def log_error(self, error_message: str):
        """
        记录错误
        
        Args:
            error_message: 错误消息
        """
        self._write(f"ERROR: {error_message}", to_console=True)
    
    def log_warning(self, warning_message: str):
        """
        记录警告
        
        Args:
            warning_message: 警告消息
        """
        if self.verbose:
            self._write(f"WARNING: {warning_message}")
    
    def log_info(self, info_message: str):
        """
        记录信息
        
        Args:
            info_message: 信息消息
        """
        if self.verbose:
            self._write(f"INFO: {info_message}")


# 注意：基本日志功能已集成在 error_handler.py 的 ErrorHandler 类中
# 本类提供更详细的增强过程日志记录，可选使用
