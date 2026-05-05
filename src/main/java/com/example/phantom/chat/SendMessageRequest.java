package com.example.phantom.chat;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class SendMessageRequest {
    @NotNull
    @NotBlank
    @Size(max = ChatConstants.MAX_MESSAGE_CONTENT_LENGTH)
    private String content;
}
