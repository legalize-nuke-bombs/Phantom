package com.example.phantom.chat.message;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
public class SendMessageRequest {
    @NotNull
    @Size(max = MessageConstants.MAX_MESSAGE_CONTENT_LENGTH)
    private String content;

    @NotNull
    private Long chatId;

    private UUID attachmentId;
}
