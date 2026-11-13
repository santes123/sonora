<?php

namespace Tests\Feature;

use Tests\TestCase;

class GoogleAuthTest extends TestCase
{
    public function test_google_redirect_aborts_with_404_when_disabled(): void
    {
        $this->get('/api/v1/auth/google/redirect')
            ->assertNotFound();
    }

    public function test_google_callback_aborts_with_404_when_disabled(): void
    {
        $this->get('/api/v1/auth/google/callback')
            ->assertNotFound();
    }
}
