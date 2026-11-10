# -*- coding: utf-8 -*-
"""AI Security Vulnerability Test Fixture (OWASP LLM Top 10)"""

def handle_user_request(user_input, response):
    # 1. CR-LLM-001: Prompt Injection via string concatenation
    llm.chat("System: You are a helpful assistant. User question: " + user_input)

    # 2. CR-LLM-002: Insecure Output Handling / eval
    generated_code = response.choices[0].message.content
    eval(generated_code)
