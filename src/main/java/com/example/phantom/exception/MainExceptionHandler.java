package com.example.phantom.exception;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

import java.util.Map;

@RestControllerAdvice
@Slf4j
public class MainExceptionHandler extends ResponseEntityExceptionHandler {

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<Map<String, String>> handleApi(ApiException e) {
        return ResponseEntity.status(e.getCode().status).body(payload(e.getCode(), e.getMessage()));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, String>> handleUnexpected(Exception e) {
        log.error("unhandled exception", e);
        return ResponseEntity.status(ErrorCode.INTERNAL_ERROR.status).body(payload(ErrorCode.INTERNAL_ERROR, null));
    }

    @Override
    protected ResponseEntity<Object> handleMethodArgumentNotValid(MethodArgumentNotValidException ex, HttpHeaders headers, HttpStatusCode status, WebRequest request) {
        String detail = ex.getBindingResult().getFieldErrors().stream()
                .findFirst()
                .map(fe -> fe.getField() + ": " + fe.getDefaultMessage())
                .orElse(null);
        return new ResponseEntity<>(payload(ErrorCode.VALIDATION_ERROR, detail), ErrorCode.VALIDATION_ERROR.status);
    }

    @Override
    protected ResponseEntity<Object> handleHandlerMethodValidationException(HandlerMethodValidationException ex, HttpHeaders headers, HttpStatusCode status, WebRequest request) {
        return new ResponseEntity<>(payload(ErrorCode.VALIDATION_ERROR, ex.getMessage()), ErrorCode.VALIDATION_ERROR.status);
    }

    @Override
    protected ResponseEntity<Object> handleExceptionInternal(Exception ex, Object body, HttpHeaders headers, HttpStatusCode statusCode, WebRequest request) {
        ErrorCode code;
        if (statusCode.value() == 404) {
            code = ErrorCode.ENDPOINT_NOT_FOUND;
        } else if (statusCode.value() == 405) {
            code = ErrorCode.METHOD_NOT_ALLOWED;
        } else if (statusCode.is5xxServerError()) {
            code = ErrorCode.INTERNAL_ERROR;
        } else {
            code = ErrorCode.MALFORMED_REQUEST;
        }
        return new ResponseEntity<>(payload(code, ex.getMessage()), headers, statusCode);
    }

    private Map<String, String> payload(ErrorCode code, String detail) {
        if (detail == null || detail.isBlank()) {
            return Map.of("code", code.name());
        }
        return Map.of("code", code.name(), "detail", detail);
    }
}
