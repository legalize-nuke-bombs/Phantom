package com.example.phantom.profile;

import com.example.phantom.experience.Experience;
import com.example.phantom.experience.ExperienceRepresentation;
import com.example.phantom.user.User;
import com.example.phantom.user.UserShortRepresentation;
import lombok.Getter;

@Getter
public class ProfileCardRepresentation {
    private final UserShortRepresentation user;
    private final ExperienceRepresentation experience;

    public ProfileCardRepresentation(User user, Experience experience) {
        this.user = new UserShortRepresentation(user);
        this.experience = new ExperienceRepresentation(experience);
    }
}
