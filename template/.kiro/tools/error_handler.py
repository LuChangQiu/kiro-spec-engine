#!/usr/bin/env python3
"""
Error Handler - 错误处理组件

提供全面的错误处理和弹性机制
"""

import logging
import traceback
from typing import Optional, Callable, Any
from enum import Enum
from dataclasses import dataclass


class ErrorSeverity(Enum):
    """错误严重程度"""
    CRITICAL = "critical"  # 致命错误，必须停止
    ERROR = "error"        # 错误，但可以继续
    WARNING = "warning"    # 警告
    INFO = "info"          # 信息


@dataclass
class ErrorContext:
    """错误上下文"""
    operation: str
    component: str
    severity: ErrorSeverity
    error: Exception
    details: dict
    stack_trace: str


class ErrorHandler:
    """
    错误处理器 - 统一错误处理和日志记录
    
    提供错误捕获、日志记录和恢复机制
    """
    
    def __init__(self, logger: Optional[logging.Logger] = None):
        """
        初始化错误处理器
        
        Args:
            logger: 日志记录器，如果为 None 则创建默认记录器
        """
        self.logger = logger or self._create_default_logger()
        self.error_history = []
    
    def _create_default_logger(self) -> logging.Logger:
        """创建默认日志记录器"""
        logger = logging.getLogger('ultrawork')
        logger.setLevel(logging.INFO)
        
        # 控制台处理器
        console_handler = logging.StreamHandler()
        console_handler.setLevel(logging.INFO)
        
        # 格式化器
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        console_handler.setFormatter(formatter)
        
        logger.addHandler(console_handler)
        
        return logger
    
    def handle_error(self, 
                    operation: str,
                    component: str,
                    error: Exception,
                    severity: ErrorSeverity = ErrorSeverity.ERROR,
                    details: Optional[dict] = None) -> ErrorContext:
        """
        处理错误
        
        Args:
            operation: 操作名称
            component: 组件名称
            error: 异常对象
            severity: 错误严重程度
            details: 额外详情
        
        Returns:
            ErrorContext: 错误上下文
        """
        # 获取堆栈跟踪
        stack_trace = traceback.format_exc()
        
        # 创建错误上下文
        context = ErrorContext(
            operation=operation,
            component=component,
            severity=severity,
            error=error,
            details=details or {},
            stack_trace=stack_trace
        )
        
        # 记录错误
        self._log_error(context)
        
        # 保存到历史
        self.error_history.append(context)
        
        return context
    
    def _log_error(self, context: ErrorContext):
        """记录错误到日志"""
        message = (
            f"[{context.component}] {context.operation} failed: "
            f"{type(context.error).__name__}: {str(context.error)}"
        )
        
        if context.details:
            message += f" | Details: {context.details}"
        
        # 根据严重程度选择日志级别
        if context.severity == ErrorSeverity.CRITICAL:
            self.logger.critical(message)
            self.logger.debug(context.stack_trace)
        elif context.severity == ErrorSeverity.ERROR:
            self.logger.error(message)
            self.logger.debug(context.stack_trace)
        elif context.severity == ErrorSeverity.WARNING:
            self.logger.warning(message)
        else:
            self.logger.info(message)
    
    def safe_execute(self,
                    operation: str,
                    component: str,
                    func: Callable,
                    default_return: Any = None,
                    severity: ErrorSeverity = ErrorSeverity.ERROR,
                    args: tuple = (),
                    kwargs: dict = None) -> tuple:
        """
        安全执行函数，捕获并处理错误
        
        Args:
            operation: 操作名称
            component: 组件名称
            func: 要执行的函数
            default_return: 发生错误时的默认返回值
            severity: 错误严重程度
            args: 函数参数元组
            kwargs: 函数关键字参数字典
        
        Returns:
            tuple[bool, Any]: (是否成功, 返回值或默认值)
        """
        if kwargs is None:
            kwargs = {}
            
        try:
            result = func(*args, **kwargs)
            return True, result
        except Exception as e:
            self.handle_error(
                operation=operation,
                component=component,
                error=e,
                severity=severity,
                details={'args': str(args), 'kwargs': str(kwargs)}
            )
            return False, default_return
    
    def get_error_summary(self) -> dict:
        """
        获取错误摘要
        
        Returns:
            dict: 错误统计信息
        """
        summary = {
            'total_errors': len(self.error_history),
            'by_severity': {},
            'by_component': {},
            'recent_errors': []
        }
        
        # 按严重程度统计
        for context in self.error_history:
            severity = context.severity.value
            summary['by_severity'][severity] = summary['by_severity'].get(severity, 0) + 1
            
            component = context.component
            summary['by_component'][component] = summary['by_component'].get(component, 0) + 1
        
        # 最近的错误（最多5个）
        for context in self.error_history[-5:]:
            summary['recent_errors'].append({
                'operation': context.operation,
                'component': context.component,
                'error': str(context.error),
                'severity': context.severity.value
            })
        
        return summary
    
    def clear_history(self):
        """清空错误历史"""
        self.error_history.clear()


# 全局错误处理器实例
_global_error_handler = None


def get_error_handler() -> ErrorHandler:
    """获取全局错误处理器"""
    global _global_error_handler
    if _global_error_handler is None:
        _global_error_handler = ErrorHandler()
    return _global_error_handler


def handle_file_system_error(operation: str, file_path: str, error: Exception) -> ErrorContext:
    """
    处理文件系统错误
    
    Args:
        operation: 操作名称（read/write/delete等）
        file_path: 文件路径
        error: 异常对象
    
    Returns:
        ErrorContext: 错误上下文
    """
    handler = get_error_handler()
    
    # 确定严重程度
    if isinstance(error, FileNotFoundError):
        severity = ErrorSeverity.ERROR
    elif isinstance(error, PermissionError):
        severity = ErrorSeverity.CRITICAL
    else:
        severity = ErrorSeverity.ERROR
    
    return handler.handle_error(
        operation=operation,
        component='FileSystem',
        error=error,
        severity=severity,
        details={'file_path': file_path}
    )


def handle_document_error(operation: str, document_type: str, error: Exception) -> ErrorContext:
    """
    处理文档处理错误
    
    Args:
        operation: 操作名称
        document_type: 文档类型（requirements/design/tasks）
        error: 异常对象
    
    Returns:
        ErrorContext: 错误上下文
    """
    handler = get_error_handler()
    
    return handler.handle_error(
        operation=operation,
        component='DocumentProcessor',
        error=error,
        severity=ErrorSeverity.ERROR,
        details={'document_type': document_type}
    )


def handle_improvement_error(improvement_type: str, error: Exception) -> ErrorContext:
    """
    处理改进应用错误
    
    Args:
        improvement_type: 改进类型
        error: 异常对象
    
    Returns:
        ErrorContext: 错误上下文
    """
    handler = get_error_handler()
    
    return handler.handle_error(
        operation='apply_improvement',
        component='ModificationApplicator',
        error=error,
        severity=ErrorSeverity.WARNING,  # 单个改进失败不是致命的
        details={'improvement_type': improvement_type}
    )


def main():
    """测试错误处理器"""
    handler = ErrorHandler()
    
    print("1. Testing safe_execute with success...")
    success, result = handler.safe_execute(
        operation='divide',
        component='Calculator',
        func=lambda x, y: x / y,
        args=(10, 2)
    )
    print(f"   Success: {success}, Result: {result}\n")
    
    print("2. Testing safe_execute with error...")
    success, result = handler.safe_execute(
        operation='divide',
        component='Calculator',
        func=lambda x, y: x / y,
        default_return=0,
        args=(10, 0)
    )
    print(f"   Success: {success}, Result: {result}\n")
    
    print("3. Testing file system error...")
    try:
        with open('nonexistent.txt', 'r') as f:
            pass
    except Exception as e:
        handle_file_system_error('read', 'nonexistent.txt', e)
    
    print("\n4. Error summary:")
    summary = handler.get_error_summary()
    print(f"   Total errors: {summary['total_errors']}")
    print(f"   By severity: {summary['by_severity']}")
    print(f"   By component: {summary['by_component']}")


if __name__ == '__main__':
    main()
