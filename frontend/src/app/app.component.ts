import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PWAIndicatorComponent } from './shared/components/pwa-indicator/pwa-indicator.component'; // ✅ เพิ่มบรรทัดนี้

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    PWAIndicatorComponent  // ✅ เพิ่มในนี้
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'support-ticket';
}