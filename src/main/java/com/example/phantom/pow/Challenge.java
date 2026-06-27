package com.example.phantom.pow;

public record Challenge(String salt, long ts, String sig, int difficulty) {
}
